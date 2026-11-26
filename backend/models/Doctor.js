const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Doctor email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    qualification: {
      type: String,
      default: 'MBBS, MD',
    },
    qualifications: {
      type: String,
      default: '',
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    consultationFee: {
      type: Number,
      default: 500,
      min: 0,
    },
    status: {
      type: String,
      enum: ['On Duty', 'In Surgery', 'Off Duty', 'On Leave', 'Active', 'Inactive'],
      default: 'On Duty',
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    availability: {
      type: String,
      default: 'Mon-Fri 9AM-5PM',
    },
    schedule: {
      type: Array,
      default: [],
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 0,
      max: 5,
    },
    patientsTreated: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

doctorSchema.pre('save', async function (next) {
  if (!this.doctorId) {
    const count = await mongoose.model('Doctor').countDocuments();
    this.doctorId = `DOC-${101 + count}`;
  }
  next();
});

module.exports = mongoose.model('Doctor', doctorSchema);
