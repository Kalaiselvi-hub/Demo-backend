const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role / Designation is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    assignedShift: {
      type: String,
      required: [true, 'Assigned shift is required'],
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On Leave'],
      default: 'Active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

staffSchema.pre('save', async function (next) {
  if (!this.staffId) {
    const count = await mongoose.model('Staff').countDocuments();
    this.staffId = `STF-${String(count + 1).padStart(2, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
