const NotificationSettings = require('../models/NotificationSettings');
const Notification = require('../models/Notification');

const TYPE_TO_SETTING_KEY = {
  emergency: 'emergencyCodeBlue',
  inventory: 'criticalLowStock',
  finance: 'dailyFinancialSummary',
  patient: 'patientAdmissionDischargeSMS',
  security: 'securityAuditLog',
};

const getOrCreateSettings = async (adminId) => {
  let settings = await NotificationSettings.findOne({ adminId });
  if (!settings) {
    settings = await NotificationSettings.create({ adminId });
  }
  return settings;
};

const dispatchNotification = async ({ userId, title, message, type, priority = 'medium' }) => {
  const settings = await getOrCreateSettings(userId);
  const settingKey = TYPE_TO_SETTING_KEY[type];

  if (settingKey && settings[settingKey] && settings[settingKey].enabled === false) {
    return { dispatched: false, reason: `Notification preference '${settingKey}' is disabled.` };
  }

  const notification = await Notification.create({
    userId,
    title,
    message,
    type,
    priority,
  });

  return { dispatched: true, notification };
};

module.exports = { getOrCreateSettings, dispatchNotification, TYPE_TO_SETTING_KEY };
