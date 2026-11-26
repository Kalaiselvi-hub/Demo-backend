const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    serviceCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    hmoCoverage: {
      type: String,
      default: '100% Covered',
      trim: true,
    },
    tariffCategory: {
      type: String,
      enum: ['Consultation', 'Emergency', 'Inpatient', 'Laboratory', 'Radiology', 'Surgical'],
    },
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Consultations',
        'Surgical Procedures',
        'Laboratory Tests',
        'Radiology / Imaging',
        'Inpatient Suites',
      ],
      default: 'Surgical Procedures',
    },
    departmentCategory: {
      type: String,
      default: 'General Medicine',
      trim: true,
    },
    departmentCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    clinicalPreparationInstructions: {
      type: String,
      default: '',
      trim: true,
    },
    standardDuration: {
      type: String,
      default: '30 mins',
      trim: true,
    },
    needsSpecialPrep: {
      type: Boolean,
      default: false,
    },
    standardTariff: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

serviceSchema.pre('save', async function (next) {
  if (!this.code) {
    const count = await mongoose.model('Service').countDocuments();
    this.code = `TRT-${String(count + 1).padStart(2, '0')}`;
  }
  if (!this.price && this.standardTariff) {
    this.price = this.standardTariff;
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
