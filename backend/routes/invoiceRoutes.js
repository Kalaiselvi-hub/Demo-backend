const express = require('express');
const {
  getInvoiceSummary,
  getMonthlyRevenue,
  getInvoices,
  getInvoiceById,
  createInvoice,
  generateBill,
  updateInvoice,
  recordPayment,
  deleteInvoice,
} = require('../controllers/invoiceController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'));

router.get('/stats/summary', getInvoiceSummary);
router.get('/stats/monthly-revenue', getMonthlyRevenue);

router.get('/', getInvoices);
router.post('/', (req, res, next) => {
  if (req.baseUrl === '/api/bills') return generateBill(req, res, next);
  return createInvoice(req, res, next);
});
router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.patch('/:id/payment', recordPayment);
router.delete('/:id', deleteInvoice);

module.exports = router;
