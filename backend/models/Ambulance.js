const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Available', 'Maintenance'],
      default: 'Available',
    },
    driverName: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
    },
    driverOnDuty: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambulance', ambulanceSchema);
