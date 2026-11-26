const mongoose = require('mongoose');

const settingItemSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const notificationSettingsSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      unique: true,
    },
    emergencyCodeBlue: {
      type: settingItemSchema,
      default: () => ({ enabled: true, updatedAt: new Date() }),
    },
    criticalLowStock: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 10 },
      updatedAt: { type: Date, default: Date.now },
    },
    dailyFinancialSummary: {
      enabled: { type: Boolean, default: true },
      scheduledTime: { type: String, default: '20:00' },
      updatedAt: { type: Date, default: Date.now },
    },
    patientAdmissionDischargeSMS: {
      type: settingItemSchema,
      default: () => ({ enabled: true, updatedAt: new Date() }),
    },
    securityAuditLog: {
      type: settingItemSchema,
      default: () => ({ enabled: true, updatedAt: new Date() }),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationSettings', notificationSettingsSchema);
