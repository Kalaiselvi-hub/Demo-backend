const mongoose = require('mongoose');

const maintenanceLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment',
    },
    equipmentId: {
      type: String,
      required: true,
      trim: true,
    },
    lastServiced: {
      type: Date,
      required: true,
    },
    nextCalibration: {
      type: Date,
      required: true,
    },
    serviceNotes: {
      type: String,
      default: '',
      trim: true,
    },
    servicedBy: {
      type: String,
      default: 'Biomedical Engineer',
      trim: true,
    },
  },
  { timestamps: true }
);

maintenanceLogSchema.pre('save', async function (next) {
  if (!this.logId) {
    const count = await mongoose.model('MaintenanceLog').countDocuments();
    this.logId = `MNT-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('MaintenanceLog', maintenanceLogSchema);
