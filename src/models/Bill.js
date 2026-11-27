const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    patientId: {
      type: String,
      trim: true,
      default: "",
    },
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    items: {
      type: [billItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Unpaid", "Partial", "Paid"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      default: "Card",
      trim: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

billSchema.pre("save", async function () {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("Bill").countDocuments();
    this.invoiceNumber = `INV-${year}-${String(841 + count).padStart(4, "0")}-${Date.now().toString().slice(-3)}`;
  }
});

module.exports = mongoose.model("Bill", billSchema);
