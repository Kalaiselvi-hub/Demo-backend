const mongoose = require('mongoose');

const bloodBankSchema = new mongoose.Schema(
  {
    bloodGroup: {
      type: String,
      required: true,
      unique: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    },
    units: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Optimal', 'Low', 'Critical'],
      default: 'Optimal',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BloodBank', bloodBankSchema);
