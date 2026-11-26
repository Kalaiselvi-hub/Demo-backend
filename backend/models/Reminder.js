const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    reminderId: {
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
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['SMS', 'Email', 'WhatsApp'],
      default: 'SMS',
    },
    message: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Sent', 'Failed'],
      default: 'Sent',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

reminderSchema.pre('save', async function (next) {
  if (!this.reminderId) {
    const count = await mongoose.model('Reminder').countDocuments();
    this.reminderId = `REM-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Reminder', reminderSchema);
