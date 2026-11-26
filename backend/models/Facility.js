const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    facilityId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Facility name is required'],
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      default: 'General',
      trim: true,
    },
    totalBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'Operational',
        'Active Surgery',
        'Optimal Supply',
        'Level-1 Ready',
        'Ready 24/7',
        'Maintenance',
        'Closed',
      ],
      default: 'Operational',
    },
    totalCapacity: {
      type: mongoose.Schema.Types.Mixed,
      default: 0,
    },
    capacityUnit: {
      type: String,
      default: 'Beds',
      trim: true,
    },
    currentLoad: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeCapacity: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentLoadText: {
      type: String,
      default: '',
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

facilitySchema.pre('save', async function (next) {
  if (!this.facilityId) {
    const count = await mongoose.model('Facility').countDocuments();
    this.facilityId = `FAC-${String(count + 1).padStart(2, '0')}`;
  }
  if (typeof this.totalCapacity === 'number') {
    this.freeCapacity = Math.max(0, this.totalCapacity - (this.currentLoad || 0));
  }
  next();
});

module.exports = mongoose.model('Facility', facilitySchema);
