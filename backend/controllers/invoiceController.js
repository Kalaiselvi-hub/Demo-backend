const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GET /api/invoices/stats/summary
const getInvoiceSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [agg, todayAgg, totalInvoices, paidInvoices] = await Promise.all([
      Invoice.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$totalAmount' },
            totalCollected: { $sum: { $ifNull: ['$paidAmount', { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0] }] } },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { isActive: { $ne: false }, updatedAt: { $gte: startOfToday }, paymentStatus: { $in: ['Paid', 'Partial', 'Partially Paid'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$paidAmount', '$totalAmount'] } } } },
      ]),
      Invoice.countDocuments({ isActive: { $ne: false } }),
      Invoice.countDocuments({ isActive: { $ne: false }, paymentStatus: 'Paid' }),
    ]);

    const totalBilled = agg[0]?.totalBilled || 0;
    const totalCollected = agg[0]?.totalCollected || 0;
    const pendingDue = Math.max(0, totalBilled - totalCollected);
    const dailyCollectionToday = todayAgg[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        totalBilled,
        totalCollected,
        pendingDue,
        dailyCollectionToday,
        totalInvoices,
        paidInvoices,
        pendingInvoices: Math.max(0, totalInvoices - paidInvoices),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invoices/stats/monthly-revenue
const getMonthlyRevenue = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const agg = await Invoice.aggregate([
      { $match: { isActive: { $ne: false }, issuedAt: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { $month: '$issuedAt' }, revenue: { $sum: '$totalAmount' } } },
    ]);

    const revMap = new Map(agg.map((a) => [a._id, a.revenue]));
    const data = MONTH_NAMES.slice(0, 7).map((month, idx) => ({
      month,
      revenue: revMap.get(idx + 1) || 0,
    }));

    return res.status(200).json({ success: true, year, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invoices?search=&status=&page=1&limit=10
const getInvoices = async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 10 } = req.query;
    const filter = { isActive: { $ne: false } };

    if (status && status !== 'All') filter.paymentStatus = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ invoiceNumber: regex }, { patientName: regex }];
    }

    const total = await Invoice.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);

    const invoices = await Invoice.find(filter)
      .populate('patient', 'patientId name phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'appointmentId appointmentDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      total,
      count: invoices.length,
      data: invoices,
      invoices,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch invoices.', error: error.message });
  }
};

// GET /api/invoices/:id
const getInvoiceById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { invoiceNumber: req.params.id.toUpperCase() };

    const invoice = await Invoice.findOne(filter)
      .populate('patient', 'patientId name phone')
      .populate('doctor', 'name specialization');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/invoices
const createInvoice = async (req, res) => {
  try {
    const { patient, patientId, patientName, items = [], tax = 0, discount = 0, paidAmount = 0, paymentMethod } = req.body;

    let patRef = patient;
    let resolvedName = patientName || '';
    if (!patRef && patientId) {
      const p = await Patient.findOne({ patientId });
      if (p) {
        patRef = p._id;
        resolvedName = resolvedName || p.name;
      }
    }

    const computedItems = items.map((item) => {
      const unitPrice = Number(item.unitPrice ?? item.amount ?? 0);
      const quantity = Number(item.quantity || 1);
      return {
        description: item.description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });

    const subtotal = computedItems.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = Math.max(0, subtotal + Number(tax) - Number(discount));
    const paid = Number(paidAmount) || 0;
    const balanceDue = Math.max(0, totalAmount - paid);
    const paymentStatus = balanceDue === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

    const invoice = await Invoice.create({
      ...req.body,
      patient: patRef,
      patientName: resolvedName,
      items: computedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      paidAmount: paid,
      balanceDue,
      paymentStatus,
      paymentMethod: paymentMethod || 'Pending',
      createdBy: req.admin._id,
    });

    const populated = await Invoice.findById(invoice._id)
      .populate('patient', 'patientId name phone')
      .populate('doctor', 'name specialization');

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: populated,
      invoice: populated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/invoices/:id
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    return res.status(200).json({ success: true, message: 'Invoice updated.', data: invoice });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/invoices/:id/payment
const recordPayment = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const payAmount = Number(amount);
    if (Number.isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount (> 0) is required.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { invoiceNumber: req.params.id.toUpperCase() };

    const invoice = await Invoice.findOne(filter);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    invoice.paidAmount = (invoice.paidAmount || 0) + payAmount;
    invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    invoice.paymentStatus = invoice.balanceDue === 0 ? 'Paid' : invoice.paidAmount > 0 ? 'Partial' : 'Pending';
    if (paymentMethod) invoice.paymentMethod = paymentMethod;

    await invoice.save();
    return res.status(200).json({ success: true, message: 'Payment recorded successfully.', data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/invoices/:id
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    return res.status(200).json({ success: true, message: 'Invoice deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/bills
const generateBill = async (req, res) => {
  try {
    const { patient, patientId, patientName, paymentMethod, markAsPaid = false, items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one service item is required.' });
    }

    for (const item of items) {
      const qty = Number(item.qty ?? item.quantity ?? 0);
      const rate = Number(item.rate ?? item.unitPrice ?? 0);
      if (qty <= 0 || rate <= 0) {
        return res.status(400).json({ success: false, message: 'Each item must have qty > 0 and rate > 0.' });
      }
    }

    let patRef = patient;
    let resolvedName = patientName || '';
    if (!patRef && patientId) {
      const p = await Patient.findOne({ patientId });
      if (p) {
        patRef = p._id;
        resolvedName = resolvedName || p.name;
      }
    }

    const computedItems = items.map((item) => {
      const qty = Number(item.qty ?? item.quantity ?? 1);
      const rate = Number(item.rate ?? item.unitPrice ?? 0);
      return {
        description: item.serviceName || item.description || 'Hospital Service',
        quantity: qty,
        unitPrice: rate,
        total: qty * rate,
      };
    });

    const subtotal = computedItems.reduce((sum, i) => sum + i.total, 0);
    const vatRate = 7.5;
    const vatAmount = Math.round((subtotal * vatRate) / 100);
    const grandTotal = subtotal + vatAmount;

    const paidAmount = markAsPaid ? grandTotal : 0;
    const balanceDue = Math.max(0, grandTotal - paidAmount);
    const paymentStatus = markAsPaid ? 'Paid' : 'Pending';

    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-${101 + count}`;
    const receiptNumber = markAsPaid ? `RCT-${101 + count}` : undefined;

    const invoice = await Invoice.create({
      invoiceNumber,
      receiptNumber,
      patient: patRef,
      patientName: resolvedName,
      items: computedItems,
      subtotal,
      vatRate,
      vatAmount,
      tax: vatAmount,
      grandTotal,
      totalAmount: grandTotal,
      paidAmount,
      balanceDue,
      paymentStatus,
      markAsPaid: Boolean(markAsPaid),
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: {
        _id: invoice._id,
        invoiceId: invoice.invoiceNumber,
        patientName: invoice.patientName,
        paymentMethod: invoice.paymentMethod,
        items: computedItems.map((i) => ({
          serviceName: i.description,
          qty: i.quantity,
          rate: i.unitPrice,
          lineTotal: i.total,
        })),
        subtotal,
        vatRate,
        vatAmount,
        grandTotal,
        paidAmount,
        balanceDue,
        paymentStatus,
        receiptNumber: invoice.receiptNumber || null,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getInvoiceSummary,
  getMonthlyRevenue,
  getInvoices,
  getInvoiceById,
  createInvoice,
  generateBill,
  updateInvoice,
  recordPayment,
  deleteInvoice,
};
