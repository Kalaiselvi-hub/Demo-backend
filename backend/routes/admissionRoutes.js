const express = require('express');
const {
  getAdmissions,
  getDailyAdmissions,
  getDischargedPatients,
  getAdmissionFile,
  getAdmissionsOverview,
  createAdmission,
  updateAdmission,
  updateAdmissionStatus,
  dischargePatient,
} = require('../controllers/admissionController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/overview', getAdmissionsOverview);
router.get('/daily', getDailyAdmissions);
router.get('/discharged', getDischargedPatients);
router.get('/discharged/:id', getAdmissionFile);

router.get('/', getAdmissions);
router.post('/', createAdmission);

router.get('/:id/file', getAdmissionFile);
router.get('/:id/discharge-summary', getAdmissionFile);
router.put('/:id', updateAdmission);
router.patch('/:id/status', updateAdmissionStatus);
router.patch('/:id/discharge', dischargePatient);

module.exports = router;
