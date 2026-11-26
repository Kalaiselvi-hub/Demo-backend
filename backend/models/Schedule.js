const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    doctorId: {
      type: String,
      required: [true, 'Doctor ID is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Doctor full name is required'],
      trim: true,
    },
    specialty: {
      type: String,
      required: [true, 'Specialty is required'],
      trim: true,
    },
    day: {
      type: String,
      required: [true, 'Day is required'],
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      uppercase: true,
    },
    shift: {
      type: String,
      required: [true, 'Shift time or status is required'],
      trim: true,
    },
    type: {
      type: String,
      default: 'Clinic',
      trim: true,
    },
    status: {
      type: String,
      enum: ['On Duty', 'On Call', 'Off Duty', 'Emergency Only', 'NICU Rounds', 'Labor Ward On Call'],
      default: 'On Duty',
    },
    week: {
      type: Number,
      required: [true, 'Week number is required'],
      min: 1,
      max: 53,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
