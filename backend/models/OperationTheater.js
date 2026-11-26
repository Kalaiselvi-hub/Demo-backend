const mongoose = require('mongoose');

const operationTheaterSchema = new mongoose.Schema(
  {
    theaterId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Scheduled', 'Sterile', 'Cleaning'],
      default: 'Sterile',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OperationTheater', operationTheaterSchema);
