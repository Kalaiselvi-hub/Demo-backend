const express = require('express');
const {
  getClinicalRecords,
  exportClinicalRecords,
  getRecordsByPatient,
  getClinicalRecordById,
  getRecordVitals,
  getRecordLabs,
  getRecordPrescriptions,
  getRecordNotes,
  createClinicalRecord,
  updateClinicalRecord,
  updateClinicalStatus,
  deleteClinicalRecord,
} = require('../controllers/clinicalRecordController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/export', exportClinicalRecords);
router.get('/patient/:patientId', getRecordsByPatient);

router.get('/', getClinicalRecords);
router.post('/', createClinicalRecord);

router.get('/:id', getClinicalRecordById);
router.get('/:id/details', getClinicalRecordById);
router.get('/:id/vitals', getRecordVitals);
router.get('/:id/labs', getRecordLabs);
router.get('/:id/prescriptions', getRecordPrescriptions);
router.get('/:id/notes', getRecordNotes);

router.put('/:id', updateClinicalRecord);
router.patch('/:id/status', updateClinicalStatus);
router.delete('/:id', deleteClinicalRecord);

module.exports = router;
