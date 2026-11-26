const express = require('express');
const {
  getEquipmentSummary,
  getEquipment,
  getServiceDueEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  updateEquipmentService,
  deleteEquipment,
  exportEquipmentCsv,
  exportEquipmentPdf,
} = require('../controllers/equipmentController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Clinical Administration', 'Super Administrator', 'Full EMR Access'));

router.get('/stats/summary', getEquipmentSummary);
router.get('/service-due', getServiceDueEquipment);
router.get('/export/csv', exportEquipmentCsv);
router.get('/export/pdf', exportEquipmentPdf);

router.get('/', getEquipment);
router.post('/', createEquipment);
router.get('/:id', getEquipmentById);
router.patch('/:id/service', updateEquipmentService);
router.patch('/:id', updateEquipment);
router.delete('/:id', deleteEquipment);

module.exports = router;
