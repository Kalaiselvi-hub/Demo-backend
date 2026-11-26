const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      unique: true,
      trim: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
    },
    patientFullName: {
      type: String,
      trim: true,
    },
    contactPhoneNumber: {
      type: String,
      trim: true,
    },
    patientAge: {
      type: Number,
      min: 0,
      max: 120,
    },
    consultingPhysician: {
      type: String,
      trim: true,
    },
    symptoms: {
      type: String,
      default: '',
      trim: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      type: String,
      required: [true, 'Time slot is required'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
    },
    reason: {
      type: String,
      default: 'General Consultation',
    },
    visitType: {
      type: String,
      enum: ['Follow-up', 'Consultation', 'New Patient', 'Checkup', 'Diagnostics', 'Antenatal'],
      default: 'Consultation',
    },
    priority: {
      type: String,
      enum: ['Normal', 'Urgent', 'Emergency'],
      default: 'Normal',
    },
    status: {
      type: String,
      enum: ['Confirmed', 'Pending', 'In Progress', 'In Consultation', 'Completed', 'Cancelled', 'Scheduled', 'No-Show'],
      default: 'Pending',
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

appointmentSchema.pre('save', function (next) {
  if (!this.appointmentId) {
    this.appointmentId = `APT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  next();
});

appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ patientFullName: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
