const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    assetId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    equipmentDescription: {
      type: String,
      required: [true, 'Equipment description is required'],
      trim: true,
    },
    modelSpecs: {
      type: String,
      required: [true, 'Model / Specs is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      unique: true,
      trim: true,
    },
    lastServiced: {
      type: Date,
      required: [true, 'Last serviced date is required'],
    },
    nextCalibration: {
      type: Date,
      required: [true, 'Next calibration date is required'],
    },
    underMaintenance: {
      type: Boolean,
      default: false,
    },
    serviceNotes: {
      type: String,
      default: '',
      trim: true,
    },
    servicedBy: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

equipmentSchema.pre('save', async function (next) {
  if (!this.equipmentId && !this.assetId) {
    const count = await mongoose.model('Equipment').countDocuments();
    const generated = `EQP-${String(count + 1).padStart(2, '0')}`;
    this.equipmentId = generated;
    this.assetId = generated;
  } else if (this.equipmentId && !this.assetId) {
    this.assetId = this.equipmentId;
  } else if (this.assetId && !this.equipmentId) {
    this.equipmentId = this.assetId;
  }
  next();
});

module.exports = mongoose.model('Equipment', equipmentSchema);
