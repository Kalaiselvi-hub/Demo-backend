const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
    },
    patientName: {
      type: String,
      default: '',
      trim: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    items: {
      type: [invoiceItemSchema],
      validate: [(arr) => arr.length > 0, 'At least one invoice item is required'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    vatRate: {
      type: Number,
      default: 7.5,
    },
    vatAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partial', 'Partially Paid', 'Unpaid', 'Cancelled'],
      default: 'Pending',
    },
    markAsPaid: {
      type: Boolean,
      default: false,
    },
    receiptNumber: {
      type: String,
      sparse: true,
      trim: true,
    },
    insuranceProvider: {
      type: String,
      default: 'Self Pay',
      trim: true,
    },
    department: {
      type: String,
      default: 'General Medicine & Emergency',
      trim: true,
    },
    paymentType: {
      type: String,
      enum: ['HMO', 'Self-Pay', 'Corporate', 'Insurance'],
      default: 'Self-Pay',
    },
    servicesRendered: {
      type: String,
      default: '',
      trim: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    lastReminderAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      default: 'Pending',
      trim: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

invoiceSchema.pre('save', function (next) {
  if (!this.invoiceNumber) {
    this.invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
