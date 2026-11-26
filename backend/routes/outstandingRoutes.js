const express = require('express');
const {
  getOutstandingSummary,
  getOutstandingInvoices,
  getOutstandingById,
  sendReminder,
  collectPayment,
} = require('../controllers/outstandingController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'));

router.get('/stats/summary', getOutstandingSummary);
router.get('/', getOutstandingInvoices);
router.get('/:id', getOutstandingById);
router.post('/:id/send-reminder', sendReminder);
router.post('/:id/collect-payment', collectPayment);

module.exports = router;
