const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
    },
    headOfDept: {
      type: String,
      default: '',
      trim: true,
    },
    headDoctorId: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    beds: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    occupiedBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    activeCases: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    occupiedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    operationalStatus: {
      type: String,
      enum: ['Active 24/7', 'Operational 24x7', 'Operational', 'Busy', 'Available', 'Maintenance', 'Closed'],
      default: 'Operational 24x7',
    },
    status: {
      type: String,
      enum: ['Operational', 'Busy', 'Available'],
      default: 'Operational',
    },
    triageLevel: {
      type: String,
      enum: ['Green Response', 'Yellow', 'Red'],
      default: 'Green Response',
    },
    averageWaitTimeMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);

