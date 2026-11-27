const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    specialization: {
      type: String,
      required: [true, "Specialization is required"],
      trim: true,
    },
    department: {
      type: String,
      default: "General Medicine",
      trim: true,
    },
    qualifications: {
      type: String,
      default: "MBBS, MD",
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 5,
    },
    consultationFee: {
      type: Number,
      default: 500,
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    status: {
      type: String,
      enum: ["On Duty", "Off Duty", "In Surgery", "On Leave"],
      default: "On Duty",
    },
    availability: {
      type: String,
      default: "Mon-Fri 9AM-5PM",
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    schedule: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        Monday: "08:00 - 16:00",
        Tuesday: "08:00 - 16:00",
        Wednesday: "08:00 - 16:00",
        Thursday: "08:00 - 16:00",
        Friday: "08:00 - 14:00",
        Saturday: "On Call",
        Sunday: "Off Duty",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

doctorSchema.pre("save", async function () {
  if (!this.doctorId) {
    const count = await mongoose.model("Doctor").countDocuments();
    this.doctorId = `DOC-${String(count + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;
  }
});

module.exports = mongoose.model("Doctor", doctorSchema);
