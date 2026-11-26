const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorPortalAccessSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    doctorId: {
      type: String,
      required: [true, 'Doctor ID is required'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    securityRole: {
      type: String,
      required: [true, 'Security role is required'],
      enum: [
        'Chief Medical Director',
        'Senior Consultant',
        'Consultant Surgeon',
        'Consultant Pediatrician',
        'Consultant Neurologist',
        'Consultant Gynecologist',
        'Consultant',
        'Resident Doctor',
      ],
      default: 'Consultant',
    },
    twoFactorAuth: {
      enabled: { type: Boolean, default: false },
      method: { type: String, default: 'OTP' },
    },
    otpCode: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    lastPortalAccess: {
      type: Date,
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
    },
    resetToken: {
      type: String,
      select: false,
    },
    resetTokenExpiry: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

doctorPortalAccessSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

doctorPortalAccessSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('DoctorPortalAccess', doctorPortalAccessSchema);
