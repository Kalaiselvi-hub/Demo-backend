const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
    },
    role: {
      type: String,
      required: [true, "Staff role is required"],
      trim: true,
    },
    department: {
      type: String,
      default: "General",
      trim: true,
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
    shift: {
      type: String,
      default: "Morning (08:00 - 16:00)",
      trim: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Active", "On Leave", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

staffSchema.pre("save", async function () {
  if (!this.staffId) {
    const count = await mongoose.model("Staff").countDocuments();
    this.staffId = `STF-${String(count + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;
  }
});

module.exports = mongoose.model("Staff", staffSchema);
