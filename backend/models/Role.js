const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    roleName: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    permissions: {
      patients: { type: Boolean, default: false },
      doctors: { type: Boolean, default: false },
      billing: { type: Boolean, default: false },
      staff: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
      settings: { type: Boolean, default: false },
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

roleSchema.pre('save', async function (next) {
  if (!this.roleId) {
    const count = await mongoose.model('Role').countDocuments();
    this.roleId = `ROLE-${String(count + 1).padStart(2, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);
