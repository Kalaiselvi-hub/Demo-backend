const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    patientFullName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    patientAge: {
      type: Number,
      default: 30,
    },
    contactPhoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    consultingPhysician: {
      type: String,
      default: "Doctor",
      trim: true,
    },
    department: {
      type: String,
      default: "General Medicine",
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: [true, "Appointment date is required"],
      default: Date.now,
    },
    timeSlot: {
      type: String,
      default: "10:00 AM",
      trim: true,
    },
    reason: {
      type: String,
      default: "Routine Medical Checkup",
      trim: true,
    },
    appointmentType: {
      type: String,
      default: "Consultation",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["Normal", "Urgent", "Emergency", "High"],
      default: "Normal",
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled", "No-Show"],
      default: "Pending",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

appointmentSchema.pre("save", async function () {
  if (!this.appointmentId) {
    const count = await mongoose.model("Appointment").countDocuments();
    this.appointmentId = `APT-${String(201 + count).padStart(4, "0")}-${Date.now().toString().slice(-4)}`;
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
