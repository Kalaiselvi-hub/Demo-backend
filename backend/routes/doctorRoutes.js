const express = require('express');
const {
  getDoctors,
  getDoctorsByDepartment,
  getDoctorsOverview,
  getSpecializations,
  checkDoctorDuplicate,
  getDoctorProfile,
  getDoctorPatients,
  getDoctorAppointments,
  getDoctorSchedule,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  deleteDoctor,
} = require('../controllers/doctorController');
const { getDoctorSchedulesRoster } = require('../controllers/scheduleController');
const {
  getAllPortalAccess,
  getPortalAccessByDoctorId,
  createPortalAccess,
  updatePortalAccess,
  suspendPortalAccess,
  activatePortalAccess,
  togglePortal2FA,
  resetPortalPassword,
} = require('../controllers/doctorPortalController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/overview', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorsOverview);
router.get('/by-department', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorsByDepartment);
router.get('/specializations', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getSpecializations);
router.get('/check', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), checkDoctorDuplicate);
router.get('/schedules', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorSchedulesRoster);

router.get('/portal-access', authorizePrivileges('Super Administrator', 'Clinical Administration'), getAllPortalAccess);
router.get('/portal-access/:doctorId', authorizePrivileges('Super Administrator', 'Clinical Administration'), getPortalAccessByDoctorId);
router.post('/portal-access', authorizePrivileges('Super Administrator', 'Clinical Administration'), createPortalAccess);
router.put('/portal-access/:id', authorizePrivileges('Super Administrator', 'Clinical Administration'), updatePortalAccess);
router.patch('/portal-access/:id/suspend', authorizePrivileges('Super Administrator', 'Clinical Administration'), suspendPortalAccess);
router.patch('/portal-access/:id/activate', authorizePrivileges('Super Administrator', 'Clinical Administration'), activatePortalAccess);
router.patch('/portal-access/:id/toggle-2fa', authorizePrivileges('Super Administrator', 'Clinical Administration'), togglePortal2FA);
router.post('/portal-access/:id/reset-password', authorizePrivileges('Super Administrator', 'Clinical Administration'), resetPortalPassword);

router.get('/', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctors);
router.post('/', authorizePrivileges('Clinical Administration', 'Super Administrator'), createDoctor);

router.get('/:id', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorProfile);
router.get('/:id/profile', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorProfile);
router.get('/:id/patients', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorPatients);
router.get('/:id/appointments', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorAppointments);
router.get('/:id/schedule', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDoctorSchedule);

router.put('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateDoctor);
router.patch('/:id/status', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateDoctorStatus);
router.delete('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), deleteDoctor);

module.exports = router;
