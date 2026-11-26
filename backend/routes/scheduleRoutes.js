const express = require('express');
const {
  getSchedulesByDoctor,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/', getSchedulesByDoctor);
router.get('/:doctorId', getSchedulesByDoctor);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);

module.exports = router;
