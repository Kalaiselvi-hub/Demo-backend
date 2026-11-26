const mongoose = require('mongoose');

const privilegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Privilege name is required'],
      unique: true,
      enum: [
        'Super Administrator',
        'Full EMR Access',
        'Billing & Revenue Sign-off',
        'Pharmacy Procurement Audit',
        'Clinical Administration',
      ],
    },
    description: {
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

module.exports = mongoose.model('Privilege', privilegeSchema);
