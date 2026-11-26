const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },
    staffId: {
      type: String,
      required: true,
      trim: true,
    },
    staffName: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dateString: {
      type: String,
      trim: true,
    },
    checkIn: {
      type: String,
      default: '',
    },
    checkOut: {
      type: String,
      default: null,
    },
    attendanceStatus: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'On Leave'],
      default: 'Present',
    },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'Leave', 'On Leave'],
      default: 'Present',
    },
    workHours: {
      type: String,
      default: 'In Progress',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ staffId: 1, dateString: 1 }, { unique: true, sparse: true });

attendanceSchema.pre('save', async function (next) {
  if (!this.attendanceId) {
    const count = await mongoose.model('Attendance').countDocuments();
    this.attendanceId = `ATT-${String(count + 1).padStart(3, '0')}`;
  }
  if (!this.dateString && this.date) {
    const d = new Date(this.date);
    this.dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
