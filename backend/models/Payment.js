const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    transactionId: {
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
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    status: {
      type: String,
      enum: ['Verified', 'Pending', 'Failed'],
      default: 'Verified',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

paymentSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN-${Date.now().toString().slice(-6)}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
