const express = require('express');
const {
  getMedicineSummary,
  getMedicines,
  getLowStockMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  adjustStock,
  batchAdjustStock,
  getStockTransactions,
  deleteMedicine,
  exportMedicinesCsv,
  exportMedicinesPdf,
} = require('../controllers/pharmacyController');
const {
  getCriticalLowStock,
  getAlertsSummary,
  createPurchaseOrder,
  createBatchPurchaseOrders,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  exportAlertsCsv,
  exportAlertsPdf,
} = require('../controllers/pharmacyAlertsController');
const {
  getVendorOrdersSummary,
  getVendorOrders,
  getVendorOrderById,
  createVendorOrder,
  updateVendorOrder,
  updateVendorOrderStatus,
  deleteVendorOrder,
  exportVendorOrdersCsv,
  exportVendorOrdersPdf,
} = require('../controllers/vendorOrderController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Pharmacy Procurement Audit', 'Clinical Administration', 'Super Administrator'));

router.get('/medicines/stats/summary', getMedicineSummary);
router.get('/medicines/low-stock', getLowStockMedicines);
router.get('/medicines/export/csv', exportMedicinesCsv);
router.get('/medicines/export/pdf', exportMedicinesPdf);

router.post('/stock/batch-adjust', batchAdjustStock);
router.get('/stock/transactions', getStockTransactions);

router.get('/alerts/critical-low-stock', getCriticalLowStock);
router.get('/alerts/stats/summary', getAlertsSummary);
router.get('/alerts/export/csv', exportAlertsCsv);
router.get('/alerts/export/pdf', exportAlertsPdf);

router.post('/purchase-orders/batch', createBatchPurchaseOrders);
router.post('/purchase-orders', createPurchaseOrder);
router.get('/purchase-orders', getPurchaseOrders);
router.get('/purchase-orders/:id', getPurchaseOrderById);
router.patch('/purchase-orders/:id/status', updatePurchaseOrderStatus);
router.delete('/purchase-orders/:id', deletePurchaseOrder);

router.get('/vendor-orders/stats/summary', getVendorOrdersSummary);
router.get('/vendor-orders/export/csv', exportVendorOrdersCsv);
router.get('/vendor-orders/export/pdf', exportVendorOrdersPdf);
router.get('/vendor-orders', getVendorOrders);
router.post('/vendor-orders', createVendorOrder);
router.get('/vendor-orders/:id', getVendorOrderById);
router.patch('/vendor-orders/:id/status', updateVendorOrderStatus);
router.patch('/vendor-orders/:id', updateVendorOrder);
router.delete('/vendor-orders/:id', deleteVendorOrder);

router.get('/medicines', getMedicines);
router.post('/medicines', createMedicine);
router.get('/medicines/:id', getMedicineById);
router.patch('/medicines/:id/adjust-stock', adjustStock);
router.patch('/medicines/:id', updateMedicine);
router.delete('/medicines/:id', deleteMedicine);

module.exports = router;
