const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema(
  {
    admissionId: {
      type: String,
      unique: true,
      trim: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required'],
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'Facility reference is required'],
    },
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Admitted', 'Discharged', 'Transferred'],
      default: 'Admitted',
    },
    diagnosis: {
      type: String,
      default: '',
    },
    ward: {
      type: String,
      default: '',
    },
    bedNumber: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    clinicalSpecialty: {
      type: String,
      default: 'General Medicine',
      trim: true,
    },
    lengthOfStay: {
      type: Number,
      default: 0,
      min: 0,
    },
    isReadmission: {
      type: Boolean,
      default: false,
    },
    admissionReason: {
      type: String,
      default: '',
    },
    finalDiagnosis: {
      type: String,
      default: '',
    },
    recoveryOutcome: {
      type: String,
      enum: ['Recovered & Discharged', 'Improved', 'Referred', 'Deceased', 'Under Observation'],
    },
    dischargeSummary: {
      type: String,
      default: '',
    },
    treatmentGiven: {
      type: String,
      default: '',
    },
    followUpDate: {
      type: Date,
    },
    prescriptionsOnDischarge: {
      type: Array,
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

admissionSchema.pre('save', function (next) {
  if (!this.admissionId) {
    this.admissionId = `ADM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  next();
});

module.exports = mongoose.model('Admission', admissionSchema);
