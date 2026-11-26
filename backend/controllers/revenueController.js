const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Refund = require('../models/Refund');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GET /api/revenue/stats/summary
const getRevenueSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [invAgg, todayPayAgg, expAgg] = await Promise.all([
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
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const totalBilled = invAgg[0]?.totalBilled || 0;
    const totalCollected = invAgg[0]?.totalCollected || 0;
    const pendingDue = Math.max(0, totalBilled - totalCollected);
    const dailyCollectionToday = todayPayAgg[0]?.total || 0;
    const totalExpenses = expAgg[0]?.total || 0;
    const recoveryRate = totalBilled === 0 ? 0 : Number(((totalCollected / totalBilled) * 100).toFixed(1));
    const netMargin = totalCollected - totalExpenses;

    return res.status(200).json({
      success: true,
      data: {
        totalBilled,
        totalCollected,
        pendingDue,
        dailyCollectionToday,
        recoveryRate,
        netMargin,
        totalRevenue: totalCollected,
        totalExpenses,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/revenue/chart/revenue-vs-expenses?year=2026
const getRevenueVsExpensesChart = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [revAgg, expAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { isActive: { $ne: false }, status: 'Verified', date: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: { $month: '$date' }, revenue: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: { $month: '$date' }, expenses: { $sum: '$amount' } } },
      ]),
    ]);

    const revMap = new Map(revAgg.map((r) => [r._id, r.revenue]));
    const expMap = new Map(expAgg.map((e) => [e._id, e.expenses]));

    const data = MONTH_NAMES.slice(0, 7).map((month, idx) => ({
      month,
      revenue: revMap.get(idx + 1) || 0,
      expenses: expMap.get(idx + 1) || 0,
    }));

    return res.status(200).json({ success: true, year, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/revenue/refunds?search=&status=&page=1&limit=10
const getRefunds = async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 10 } = req.query;
    const filter = { isActive: { $ne: false } };

    if (status && status !== 'All') filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ refundId: regex }, { invoiceId: regex }, { patientName: regex }];
    }

    const total = await Refund.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);
    const refunds = await Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

    return res.status(200).json({ success: true, total, count: refunds.length, data: refunds });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/revenue/refunds/:id
const getRefundById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { refundId: req.params.id.toUpperCase() };

    const refund = await Refund.findOne(filter).lean();
    if (!refund) return res.status(404).json({ success: false, message: 'Refund record not found.' });
    return res.status(200).json({ success: true, data: refund });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/revenue/refunds
const createRefund = async (req, res) => {
  try {
    const { invoiceId, patientId, patientName, reason, amount } = req.body;
    if (!invoiceId || !patientName || !reason || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'invoiceId, patientName, reason, and amount (> 0) are required.' });
    }

    const invoice = await Invoice.findOne({ invoiceNumber: invoiceId });
    const refund = await Refund.create({
      invoice: invoice?._id,
      invoiceId,
      patientId: patientId || '',
      patientName,
      reason,
      amount: Number(amount),
    });

    return res.status(201).json({ success: true, message: 'Refund request created.', data: refund });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/revenue/refunds/:id/approve
const approveRefund = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { refundId: req.params.id.toUpperCase() };

    const refund = await Refund.findOne(filter);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund record not found.' });

    refund.status = 'Approved';
    refund.approvedBy = req.admin?.name || 'Administrator';
    await refund.save();

    return res.status(200).json({ success: true, message: 'Refund approved.', data: refund });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/revenue/refunds/:id/reject
const rejectRefund = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { refundId: req.params.id.toUpperCase() };

    const refund = await Refund.findOne(filter);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund record not found.' });

    refund.status = 'Rejected';
    refund.approvedBy = req.admin?.name || 'Administrator';
    await refund.save();

    return res.status(200).json({ success: true, message: 'Refund rejected.', data: refund });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/revenue/refunds/:id
const deleteRefund = async (req, res) => {
  try {
    const deleted = await Refund.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Refund record not found.' });
    return res.status(200).json({ success: true, message: 'Refund record deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRevenueSummary,
  getRevenueVsExpensesChart,
  getRefunds,
  getRefundById,
  createRefund,
  approveRefund,
  rejectRefund,
  deleteRefund,
};
