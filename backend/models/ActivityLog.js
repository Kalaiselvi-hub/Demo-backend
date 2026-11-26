const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['patient', 'appointment', 'lab', 'payment', 'system'],
      default: 'system',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      default: 'Just now',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
