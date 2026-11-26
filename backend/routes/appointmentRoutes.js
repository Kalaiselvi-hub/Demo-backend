const express = require('express');
const {
  getAppointments,
  getAppointmentStats,
  getStatusBreakdown,
  getAppointmentsPerDay,
  getAppointmentCalendar,
  getAppointmentsPerWeek,
  getAvailableSlots,
  bookAppointment,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
} = require('../controllers/appointmentController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/stats', getAppointmentStats);
router.get('/status-breakdown', getStatusBreakdown);
router.get('/per-day', getAppointmentsPerDay);
router.get('/calendar', getAppointmentCalendar);
router.get('/calendar/week', getAppointmentsPerWeek);
router.get('/per-week', getAppointmentsPerWeek);
router.get('/available-slots', getAvailableSlots);
router.post('/book', bookAppointment);

router.get('/', getAppointments);
router.post('/', createAppointment);
router.get('/:id', getAppointmentById);
router.put('/:id', updateAppointment);
router.patch('/:id/status', updateAppointmentStatus);
router.delete('/:id', deleteAppointment);

module.exports = router;
