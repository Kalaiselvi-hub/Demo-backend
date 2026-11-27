const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    age: {
      type: Number,
      default: 0,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    bloodGroup: {
      type: String,
      default: "O+",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Admitted", "Outpatient", "Discharged", "Critical", "Observation"],
      default: "Admitted",
    },
    department: {
      type: String,
      default: "General Medicine",
      trim: true,
    },
    doctor: {
      type: String,
      default: "Unassigned",
      trim: true,
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    dischargeDate: {
      type: Date,
    },
    room: {
      type: String,
      default: "General Ward",
      trim: true,
    },
    diagnosis: {
      type: String,
      default: "Under Evaluation",
      trim: true,
    },
    vitals: {
      bp: { type: String, default: "120/80 mmHg" },
      pulse: { type: String, default: "72 bpm" },
      temp: { type: String, default: "36.8 °C" },
      spo2: { type: String, default: "98%" },
      weight: { type: String, default: "70 kg" },
    },
    prescriptions: [
      {
        name: String,
        dosage: String,
        duration: String,
      },
    ],
    emergencyContact: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
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

patientSchema.pre("save", async function () {
  if (!this.patientId) {
    const count = await mongoose.model("Patient").countDocuments();
    this.patientId = `PAT-${1001 + count}-${Date.now().toString().slice(-4)}`;
  }
});

module.exports = mongoose.model("Patient", patientSchema);
