const express = require('express');
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  updatePatientStatus,
  getPatientsByDepartment,
  getNewPatientsPerMonth,
  getPatientsOverview,
  getBloodGroups,
  getGenders,
} = require('../controllers/patientController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/overview', getPatientsOverview);
router.get('/by-department', getPatientsByDepartment);
router.get('/new-per-month', getNewPatientsPerMonth);
router.get('/blood-groups', getBloodGroups);
router.get('/genders', getGenders);
router.get('/list', getPatients);

router.get('/', getPatients);
router.post('/', createPatient);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.patch('/:id/status', updatePatientStatus);

module.exports = router;
