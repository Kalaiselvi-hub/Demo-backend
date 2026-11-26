const express = require('express');
const {
  getSettings,
  updateAllSettings,
  updateSingleSetting,
  createNotificationEvent,
  getNotificationHistory,
  markAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/settings', getSettings);
router.put('/settings', updateAllSettings);
router.patch('/settings/:notificationKey', updateSingleSetting);

router.post('/events', createNotificationEvent);
router.get('/history', getNotificationHistory);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
