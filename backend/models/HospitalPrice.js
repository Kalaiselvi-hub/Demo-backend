const mongoose = require('mongoose');

const hospitalPriceSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Consultation', 'Laboratory', 'Radiology', 'Surgery', 'Ward', 'Pharmacy'],
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HospitalPrice', hospitalPriceSchema);
