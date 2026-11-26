const express = require('express');
const {
  getRevenueSummary,
  getRevenueVsExpensesChart,
  getRefunds,
  getRefundById,
  createRefund,
  approveRefund,
  rejectRefund,
  deleteRefund,
} = require('../controllers/revenueController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'));

router.get('/stats/summary', getRevenueSummary);
router.get('/chart/revenue-vs-expenses', getRevenueVsExpensesChart);

router.get('/refunds', getRefunds);
router.post('/refunds', createRefund);
router.get('/refunds/:id', getRefundById);
router.patch('/refunds/:id/approve', approveRefund);
router.patch('/refunds/:id/reject', rejectRefund);
router.delete('/refunds/:id', deleteRefund);

module.exports = router;
