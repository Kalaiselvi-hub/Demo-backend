const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
    },
    medicineId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['add', 'dispense', 'adjust', 'return'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    batchNumber: {
      type: String,
      default: '',
      trim: true,
    },
    supplier: {
      type: String,
      default: '',
      trim: true,
    },
    ward: {
      type: String,
      default: '',
      trim: true,
    },
    performedBy: {
      type: String,
      default: 'Administrator',
    },
  },
  { timestamps: true }
);

stockTransactionSchema.pre('save', async function (next) {
  if (!this.transactionId) {
    const count = await mongoose.model('StockTransaction').countDocuments();
    this.transactionId = `STK-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
