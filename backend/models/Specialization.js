const mongoose = require('mongoose');

const specializationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Specialization title is required'],
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Specialization', specializationSchema);
