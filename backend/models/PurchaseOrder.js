const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema(
  {
    poId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    poNumber: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    manufacturer: {
      type: String,
      default: '',
      trim: true,
    },
    vendor: {
      type: String,
      default: '',
      trim: true,
    },
    poDate: {
      type: Date,
      default: Date.now,
    },
    consignmentSummary: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryDate: {
      type: Date,
    },
    totalInvoice: {
      type: Number,
      default: 0,
      min: 0,
    },
    items: {
      type: Array,
      default: [],
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
    },
    medicineId: {
      type: String,
      default: '',
      trim: true,
    },
    medicationName: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    unitTariff: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    supplier: {
      type: String,
      default: 'Licensed Manufacturer',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Received', 'Cancelled', 'Delivered', 'In Transit', 'Pending Approval'],
      default: 'Pending',
    },
    alertStatus: {
      type: String,
      enum: ['Urgent', 'Ordered', 'Received'],
      default: 'Ordered',
    },
    createdBy: {
      type: String,
      default: 'Administrator',
    },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre('save', async function (next) {
  if (!this.poId && !this.poNumber) {
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    const yr = new Date().getFullYear();
    const generated = `PO-${yr}-${String(count + 1).padStart(3, '0')}`;
    this.poId = generated;
    this.poNumber = generated;
  } else if (this.poId && !this.poNumber) {
    this.poNumber = this.poId;
  } else if (this.poNumber && !this.poId) {
    this.poId = this.poNumber;
  }
  next();
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
