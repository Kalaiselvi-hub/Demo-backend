const express = require('express');
const {
  getStaff,
  getStaffByRole,
  getWeeklyAttendance,
  getNextStaffId,
  getStaffDepartments,
  getStaffRoles,
  getStaffShifts,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/staffController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/by-role', getStaffByRole);
router.get('/attendance/weekly', getWeeklyAttendance);
router.get('/next-id', getNextStaffId);
router.get('/departments', getStaffDepartments);
router.get('/roles', getStaffRoles);
router.get('/shifts', getStaffShifts);
router.get('/', getStaff);
router.get('/:id', getStaffById);
router.post('/', authorizePrivileges('Clinical Administration', 'Super Administrator'), createStaff);
router.put('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateStaff);
router.delete('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), deleteStaff);

module.exports = router;
