const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      trim: true
    },

    directLine: {
      type: String,
      required: true,
      trim: true
    },

    hospitalCentre: {
      type: String,
      required: true,
      trim: true
    },

    location: {
      type: String,
      required: true,
      trim: true
    },

  role: {
    type: String,
    enum: ["admin", "user"],
    default: "admin"
  },
},

  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);