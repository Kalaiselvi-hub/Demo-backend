const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Reminder = require('../models/Reminder');

const findInvoiceByParam = (id) => {
  const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { invoiceNumber: id.toUpperCase() };
  return Invoice.findOne(filter);
};

// GET /api/outstanding/stats/summary
const getOutstandingSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [invAgg, todayPayAgg, outstandingCount] = await Promise.all([
      Invoice.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$totalAmount' },
            totalCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
            totalOverdue: { $sum: { $ifNull: ['$balanceDue', 0] } },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { isActive: { $ne: false }, status: 'Verified', date: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Invoice.countDocuments({ isActive: { $ne: false }, balanceDue: { $gt: 0 } }),
    ]);

    const totalBilled = invAgg[0]?.totalBilled || 0;
    const totalCollected = invAgg[0]?.totalCollected || 0;
    const pendingDue = Math.max(0, totalBilled - totalCollected);
    const totalOverdue = invAgg[0]?.totalOverdue || pendingDue;
    const dailyCollectionToday = todayPayAgg[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        totalBilled,
        totalCollected,
        pendingDue,
        dailyCollectionToday,
        totalOverdue,
        totalOutstandingInvoices: outstandingCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/outstanding?search=&status=&hmo=&page=1&limit=10
const getOutstandingInvoices = async (req, res) => {
  try {
    const { search = '', status = '', hmo = '', page = 1, limit = 10 } = req.query;
    const filter = { isActive: { $ne: false }, balanceDue: { $gt: 0 } };

    if (status && status !== 'All') filter.paymentStatus = status;
    if (hmo === 'true') filter.insuranceProvider = { $nin: ['Self Pay', ''] };
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ invoiceNumber: regex }, { patientName: regex }, { insuranceProvider: regex }];
    }

    const total = await Invoice.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);

    const invoices = await Invoice.find(filter)
      .sort({ issuedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalOverdue = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

    const data = invoices.map((inv) => ({
      _id: inv._id,
      invoiceId: inv.invoiceNumber,
      patientName: inv.patientName || 'Patient',
      billedDate: inv.issuedAt,
      servicesRendered: inv.servicesRendered || inv.items?.map((i) => i.description).join(' + ') || 'Hospital Services',
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount || 0,
      outstandingDue: inv.balanceDue || 0,
      paymentStatus: inv.paymentStatus,
      insuranceProvider: inv.insuranceProvider || 'Self Pay',
      reminderSent: Boolean(inv.reminderSent),
      lastReminderAt: inv.lastReminderAt || null,
    }));

    return res.status(200).json({
      success: true,
      totalOverdue,
      total,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/outstanding/:id
const getOutstandingById = async (req, res) => {
  try {
    const invoice = await findInvoiceByParam(req.params.id).lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/outstanding/:id/send-reminder
const sendReminder = async (req, res) => {
  try {
    const invoice = await findInvoiceByParam(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const { channel = 'SMS', message } = req.body || {};
    const reminderMsg =
      message ||
      `Your outstanding balance of ₦${(invoice.balanceDue || 0).toLocaleString()} is due. Please settle at NAIRA Hospital.`;

    await Reminder.create({
      invoice: invoice._id,
      invoiceId: invoice.invoiceNumber,
      patientName: invoice.patientName || 'Patient',
      channel,
      message: reminderMsg,
      amount: invoice.balanceDue || 0,
      status: 'Sent',
    });

    invoice.reminderSent = true;
    invoice.lastReminderAt = new Date();
    invoice.reminderCount = (invoice.reminderCount || 0) + 1;
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Reminder sent successfully',
      data: {
        invoiceId: invoice.invoiceNumber,
        channel,
        reminderSent: invoice.reminderSent,
        lastReminderAt: invoice.lastReminderAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/outstanding/:id/collect-payment
const collectPayment = async (req, res) => {
  try {
    const { amount, method = 'GTBank NIP Transfer' } = req.body;
    const payAmount = Number(amount);

    const invoice = await findInvoiceByParam(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const currentDue = invoice.balanceDue ?? Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0));
    if (Number.isNaN(payAmount) || payAmount <= 0 || payAmount > currentDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount must be > 0 and <= outstanding due (₦${currentDue}).`,
      });
    }

    const payment = await Payment.create({
      invoice: invoice._id,
      invoiceId: invoice.invoiceNumber,
      patientName: invoice.patientName || 'Patient',
      method,
      amount: payAmount,
      status: 'Verified',
      createdBy: req.admin._id,
    });

    invoice.paidAmount = (invoice.paidAmount || 0) + payAmount;
    invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    invoice.paymentStatus = invoice.balanceDue === 0 ? 'Paid' : invoice.paidAmount > 0 ? 'Partial' : 'Pending';
    invoice.paymentMethod = method;
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Payment collected successfully',
      data: {
        invoiceId: invoice.invoiceNumber,
        transactionId: payment.transactionId,
        paymentId: payment._id,
        paidAmount: invoice.paidAmount,
        outstandingDue: invoice.balanceDue,
        paymentStatus: invoice.paymentStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOutstandingSummary,
  getOutstandingInvoices,
  getOutstandingById,
  sendReminder,
  collectPayment,
};
