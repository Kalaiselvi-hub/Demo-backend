const LocalizationSettings = require('../models/LocalizationSettings');

const formatResponse = (doc) => ({
  ...doc,
  currency: doc.currencyCode,
  timezoneLabel: doc.hospitalTimezone,
  hotline: doc.emergencyTraumaHotline,
  backupSchedule: doc.encryptedEhrCloudBackup,
});

const getOrCreateDefault = async () => {
  let doc = await LocalizationSettings.findOne({ settingsId: 'LOC-001' }).lean();
  if (!doc) {
    const created = await LocalizationSettings.create({ settingsId: 'LOC-001' });
    doc = created.toObject();
  }
  return doc;
};

// GET /api/settings/localization & /api/settings/system
const getLocalization = async (req, res) => {
  try {
    const doc = await getOrCreateDefault();
    return res.status(200).json({ success: true, data: formatResponse(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/settings/localization & PUT /api/settings/localization
const updateLocalization = async (req, res) => {
  try {
    await getOrCreateDefault();
    const updates = { ...req.body };
    if (updates.hotline) updates.emergencyTraumaHotline = updates.hotline;
    if (updates.backupSchedule) updates.encryptedEhrCloudBackup = updates.backupSchedule;
    if (updates.timezoneLabel) updates.hospitalTimezone = updates.timezoneLabel;

    const updated = await LocalizationSettings.findOneAndUpdate(
      { settingsId: 'LOC-001' },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Localization settings updated successfully',
      data: formatResponse(updated),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/settings/localization/reset
const resetLocalization = async (req, res) => {
  try {
    const defaults = {
      hospitalName: 'NAIRA Multi-Speciality Hospital',
      primaryCurrency: 'Nigerian Naira (NGN)',
      currencyCode: 'NGN',
      currencySymbol: '₦',
      hospitalTimezone: 'Africa/Lagos (WAT, GMT+1)',
      timezone: 'Africa/Lagos',
      timezoneOffset: 'GMT+1',
      emergencyTraumaHotline: '+234 808 NAIRA (62472)',
      hotlineNumber: '+23480862472',
      encryptedEhrCloudBackup: 'Automated Daily at 02:00 AM',
      backupTime: '02:00 AM',
      backupEnabled: true,
      language: 'English',
      dateFormat: 'DD-MM-YYYY',
      timeFormat: '12-hour',
    };

    const reset = await LocalizationSettings.findOneAndUpdate(
      { settingsId: 'LOC-001' },
      { $set: defaults },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Localization settings reset to defaults.',
      data: formatResponse(reset),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getLocalization, updateLocalization, resetLocalization };
