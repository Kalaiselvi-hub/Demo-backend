const mongoose = require('mongoose');

const vitalSignsSchema = new mongoose.Schema(
  {
    bloodPressure: { type: String, default: '' },
    heartRate: { type: String, default: '' },
    temperature: { type: String, default: '' },
    oxygen: { type: String, default: '' },
    weight: { type: String, default: '' },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true },
    dosage: { type: String, required: true },
    duration: { type: String, required: true },
  },
  { _id: false }
);

const clinicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required'],
    },
    diagnosis: {
      type: String,
      required: [true, 'Diagnosis is required'],
      trim: true,
    },
    symptoms: {
      type: String,
      default: '',
      trim: true,
    },
    vitalSigns: {
      type: vitalSignsSchema,
      default: () => ({}),
    },
    labResults: {
      type: Array,
      default: [],
    },
    prescriptions: {
      type: [prescriptionSchema],
      default: [],
    },
    treatmentPlan: {
      type: String,
      default: '',
      trim: true,
    },
    doctorNotes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Recovering', 'Critical', 'Stable'],
      default: 'Active',
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    department: {
      type: String,
      default: 'General Medicine',
      trim: true,
    },
    nextVisitDate: {
      type: Date,
    },
    admissionDate: {
      type: Date,
    },
    dischargeDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClinicalRecord', clinicalRecordSchema);
