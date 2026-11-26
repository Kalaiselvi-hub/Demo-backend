const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    expenseId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Salaries', 'Drugs', 'Equipment', 'Utilities', 'Maintenance'],
      required: true,
    },
    month: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than 0'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

expenseSchema.pre('save', async function (next) {
  if (!this.expenseId) {
    const count = await mongoose.model('Expense').countDocuments();
    this.expenseId = `EXP-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
