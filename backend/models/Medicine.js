const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    medicineId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    medicationName: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    dosageForm: {
      type: String,
      required: [true, 'Dosage form is required'],
      trim: true,
    },
    stockLevel: {
      type: Number,
      required: true,
      min: [0, 'Stock level cannot be negative'],
      default: 0,
    },
    reorderAt: {
      type: Number,
      required: true,
      min: 0,
      default: 20,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    unitTariff: {
      type: Number,
      required: [true, 'Unit tariff is required'],
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

medicineSchema.pre('save', async function (next) {
  if (!this.medicineId && !this.code) {
    const count = await mongoose.model('Medicine').countDocuments();
    const generated = `MED-${String(count + 1).padStart(2, '0')}`;
    this.medicineId = generated;
    this.code = generated;
  } else if (this.medicineId && !this.code) {
    this.code = this.medicineId;
  } else if (this.code && !this.medicineId) {
    this.medicineId = this.code;
  }
  next();
});

module.exports = mongoose.model('Medicine', medicineSchema);
