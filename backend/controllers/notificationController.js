const NotificationSettings = require('../models/NotificationSettings');
const Notification = require('../models/Notification');
const { getOrCreateSettings, dispatchNotification } = require('../services/notificationService');

const ALLOWED_KEYS = [
  'emergencyCodeBlue',
  'criticalLowStock',
  'dailyFinancialSummary',
  'patientAdmissionDischargeSMS',
  'securityAuditLog',
];

// GET /api/notifications/settings
const getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.admin._id);
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load notification settings.', error: error.message });
  }
};

// PUT /api/notifications/settings
const updateAllSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.admin._id);
    const now = new Date();

    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) {
        const enabled = typeof req.body[key] === 'boolean' ? req.body[key] : Boolean(req.body[key].enabled);
        settings[key].enabled = enabled;
        settings[key].updatedAt = now;
      }
    }

    await settings.save();
    return res.status(200).json({ success: true, message: 'Notification settings updated.', data: settings });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/settings/:notificationKey
const updateSingleSetting = async (req, res) => {
  try {
    const { notificationKey } = req.params;
    if (!ALLOWED_KEYS.includes(notificationKey)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notificationKey. Must be one of: ${ALLOWED_KEYS.join(', ')}`,
      });
    }

    if (typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (boolean) is required.' });
    }

    const settings = await getOrCreateSettings(req.admin._id);
    settings[notificationKey].enabled = req.body.enabled;
    settings[notificationKey].updatedAt = new Date();
    await settings.save();

    return res.status(200).json({
      success: true,
      message: `${notificationKey} updated.`,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/notifications/events
const createNotificationEvent = async (req, res) => {
  try {
    const { title, message, type, priority = 'medium' } = req.body;
    if (!title || !message || !type) {
      return res.status(400).json({ success: false, message: 'title, message, and type are required.' });
    }

    const result = await dispatchNotification({
      userId: req.admin._id,
      title,
      message,
      type,
      priority,
    });

    if (!result.dispatched) {
      return res.status(200).json({ success: true, dispatched: false, message: result.reason });
    }

    return res.status(201).json({
      success: true,
      dispatched: true,
      message: 'Notification event created.',
      data: result.notification,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/notifications/history
const getNotificationHistory = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.admin._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ success: true, total: notifications.length, data: notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.admin._id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.status(200).json({ success: true, message: 'Marked as read.', data: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.admin._id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSettings,
  updateAllSettings,
  updateSingleSetting,
  createNotificationEvent,
  getNotificationHistory,
  markAsRead,
  deleteNotification,
};
