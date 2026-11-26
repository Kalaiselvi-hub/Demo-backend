const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GET /api/payments/stats/summary
const getPaymentSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [invAgg, todayPayAgg, totalTransactions, verifiedTransactions] = await Promise.all([
      Invoice.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$totalAmount' },
            totalCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { isActive: { $ne: false }, status: 'Verified', date: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.countDocuments({ isActive: { $ne: false } }),
      Payment.countDocuments({ isActive: { $ne: false }, status: 'Verified' }),
    ]);

    const totalBilled = invAgg[0]?.totalBilled || 0;
    const totalCollected = invAgg[0]?.totalCollected || 0;
    const pendingDue = Math.max(0, totalBilled - totalCollected);
    const dailyCollectionToday = todayPayAgg[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        totalBilled,
        totalCollected,
        pendingDue,
        dailyCollectionToday,
        totalTransactions,
        verifiedTransactions,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/stats/methods-breakdown
const getMethodsBreakdown = async (req, res) => {
  try {
    const agg = await Payment.aggregate([
      { $match: { isActive: { $ne: false }, status: 'Verified' } },
      { $group: { _id: '$method', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]);

    const totalReceived = agg.reduce((sum, m) => sum + m.amount, 0);
    const data = agg.map((m) => ({
      method: m._id,
      amount: m.amount,
      percentage: totalReceived === 0 ? 0 : Number(((m.amount / totalReceived) * 100).toFixed(2)),
    }));

    return res.status(200).json({ success: true, totalReceived, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/stats/monthly-collection
const getMonthlyCollection = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const agg = await Payment.aggregate([
      { $match: { isActive: { $ne: false }, status: 'Verified', date: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { $month: '$date' }, collection: { $sum: '$amount' } } },
    ]);

    const map = new Map(agg.map((a) => [a._id, a.collection]));
    const data = MONTH_NAMES.slice(0, 7).map((month, idx) => ({
      month,
      collection: map.get(idx + 1) || 0,
    }));

    return res.status(200).json({ success: true, year, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments?search=&method=&status=&page=1&limit=10
const getPayments = async (req, res) => {
  try {
    const { search = '', method = '', status = '', page = 1, limit = 10 } = req.query;
    const filter = { isActive: { $ne: false } };

    if (method && method !== 'All') filter.method = new RegExp(method.trim(), 'i');
    if (status && status !== 'All') filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ transactionId: regex }, { invoiceId: regex }, { patientName: regex }];
    }

    const total = await Payment.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);

    const payments = await Payment.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({ success: true, total, count: payments.length, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/:id
const getPaymentById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { transactionId: req.params.id.toUpperCase() };

    const payment = await Payment.findOne(filter).lean();
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments
const createPayment = async (req, res) => {
  try {
    const { invoiceId, patientId, patientName, method, amount, status = 'Verified' } = req.body;
    const payAmount = Number(amount);
    if (!invoiceId || !patientName || !method || Number.isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId, patientName, method, and amount (> 0) are required.',
      });
    }

    const invoice = await Invoice.findOne({ invoiceNumber: invoiceId });
    if (invoice) {
      invoice.paidAmount = (invoice.paidAmount || 0) + payAmount;
      invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      invoice.paymentStatus = invoice.balanceDue === 0 ? 'Paid' : invoice.paidAmount > 0 ? 'Partial' : 'Pending';
      invoice.paymentMethod = method;
      await invoice.save();
    }

    const payment = await Payment.create({
      invoice: invoice?._id,
      invoiceId,
      patientId: patientId || '',
      patientName,
      method,
      amount: payAmount,
      status,
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: payment,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/payments/:id
const deletePayment = async (req, res) => {
  try {
    const deleted = await Payment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    return res.status(200).json({ success: true, message: 'Payment record deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPaymentSummary,
  getMethodsBreakdown,
  getMonthlyCollection,
  getPayments,
  getPaymentById,
  createPayment,
  deletePayment,
};
