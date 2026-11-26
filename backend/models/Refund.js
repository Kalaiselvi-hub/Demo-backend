const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    invoiceId: {
      type: String,
      required: [true, 'Invoice ID is required'],
      trim: true,
    },
    patientId: {
      type: String,
      default: '',
      trim: true,
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: [true, 'Refund reason is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Refund amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Processed'],
      default: 'Pending',
    },
    approvedBy: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

refundSchema.pre('save', async function (next) {
  if (!this.refundId) {
    const count = await mongoose.model('Refund').countDocuments();
    this.refundId = `REF-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Refund', refundSchema);
