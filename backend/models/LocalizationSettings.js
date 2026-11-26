const mongoose = require('mongoose');

const localizationSettingsSchema = new mongoose.Schema(
  {
    settingsId: {
      type: String,
      unique: true,
      default: 'LOC-001',
    },
    hospitalName: {
      type: String,
      default: 'NAIRA Multi-Speciality Hospital',
    },
    primaryCurrency: {
      type: String,
      default: 'Nigerian Naira (NGN)',
    },
    currencyCode: {
      type: String,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN',
    },
    currencySymbol: {
      type: String,
      default: '₦',
    },
    hospitalTimezone: {
      type: String,
      default: 'Africa/Lagos (WAT, GMT+1)',
    },
    timezone: {
      type: String,
      default: 'Africa/Lagos',
    },
    timezoneOffset: {
      type: String,
      default: 'GMT+1',
    },
    emergencyTraumaHotline: {
      type: String,
      default: '+234 808 NAIRA (62472)',
    },
    hotlineNumber: {
      type: String,
      default: '+23480862472',
    },
    encryptedEhrCloudBackup: {
      type: String,
      default: 'Automated Daily at 02:00 AM',
    },
    backupTime: {
      type: String,
      default: '02:00 AM',
    },
    backupEnabled: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      default: 'English',
    },
    dateFormat: {
      type: String,
      default: 'DD-MM-YYYY',
    },
    timeFormat: {
      type: String,
      default: '12-hour',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LocalizationSettings', localizationSettingsSchema);
