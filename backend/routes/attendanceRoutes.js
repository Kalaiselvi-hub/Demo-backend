const express = require('express');
const {
  getAttendance,
  getTodayAttendance,
  getWeeklyAttendance,
  getAttendanceById,
  checkIn,
  checkOut,
  deleteAttendance,
} = require('../controllers/attendanceController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/today', getTodayAttendance);
router.get('/weekly', getWeeklyAttendance);
router.get('/', getAttendance);
router.get('/:id', getAttendanceById);
router.post('/check-in', checkIn);
router.patch('/check-out/:id', checkOut);
router.delete('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), deleteAttendance);

module.exports = router;
