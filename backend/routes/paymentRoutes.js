const express = require('express');
const {
  getPaymentSummary,
  getMethodsBreakdown,
  getMonthlyCollection,
  getPayments,
  getPaymentById,
  createPayment,
  deletePayment,
} = require('../controllers/paymentController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'));

router.get('/stats/summary', getPaymentSummary);
router.get('/stats/methods-breakdown', getMethodsBreakdown);
router.get('/stats/monthly-collection', getMonthlyCollection);

router.get('/', getPayments);
router.post('/', createPayment);
router.get('/:id', getPaymentById);
router.delete('/:id', deletePayment);

module.exports = router;
