const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Administrator name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    jobTitle: {
      type: String,
      default: 'Chief Medical Officer',
      trim: true,
    },
    department: {
      type: String,
      default: 'Clinical Administration',
      trim: true,
    },
    directLine: {
      type: String,
      default: '',
      trim: true,
    },
    hospitalCentre: {
      type: String,
      default: 'NAIRA Multi-Speciality Hospital - Main Campus',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['Chief Doctor', 'Super Administrator', 'Clinical Administrator', 'Billing Administrator'],
      default: 'Chief Doctor',
    },
    privileges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Privilege',
      },
    ],
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
