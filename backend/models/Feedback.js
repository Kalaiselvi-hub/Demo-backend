const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    doctorId: {
      type: String,
      trim: true,
    },
    patientName: {
      type: String,
      default: 'Anonymous Patient',
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

feedbackSchema.pre('save', async function (next) {
  if (!this.feedbackId) {
    const count = await mongoose.model('Feedback').countDocuments();
    this.feedbackId = `FBK-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);
