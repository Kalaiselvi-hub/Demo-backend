const Role = require('../models/Role');

const ALLOWED_MODULES = ['patients', 'doctors', 'billing', 'staff', 'inventory', 'reports', 'settings'];

const findRoleByParam = (id) => {
  const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { roleId: id.toUpperCase() };
  return Role.findOne(filter);
};

// GET /api/roles
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true }).sort({ roleId: 1 }).lean();
    return res.status(200).json({ success: true, totalRoles: roles.length, data: roles });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch roles.', error: error.message });
  }
};

// GET /api/roles/:id
const getRoleById = async (req, res) => {
  try {
    const role = await findRoleByParam(req.params.id).lean();
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    return res.status(200).json({ success: true, data: role });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/roles
const createRole = async (req, res) => {
  try {
    const { roleName, permissions } = req.body;
    if (!roleName) return res.status(400).json({ success: false, message: 'Role name is required.' });

    const existing = await Role.findOne({ roleName: new RegExp(`^${roleName.trim()}$`, 'i') });
    if (existing) return res.status(409).json({ success: false, message: 'Role already exists.' });

    const role = await Role.create({ roleName: roleName.trim(), permissions: permissions || {} });
    return res.status(201).json({ success: true, message: 'Role created successfully.', data: role });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/roles/:id
const updateRole = async (req, res) => {
  try {
    const role = await findRoleByParam(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.isSystemRole || role.roleName === 'Super Administrator') {
      return res.status(403).json({ success: false, message: 'Super Administrator role cannot be modified.' });
    }

    if (req.body.roleName) role.roleName = req.body.roleName;
    if (req.body.permissions) role.permissions = { ...role.permissions.toObject(), ...req.body.permissions };
    await role.save();

    return res.status(200).json({ success: true, message: 'Role updated successfully.', data: role });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/roles/:id/permissions
const toggleRolePermission = async (req, res) => {
  try {
    const { module, allowed } = req.body;
    if (!ALLOWED_MODULES.includes(module)) {
      return res.status(400).json({
        success: false,
        message: `Invalid module. Must be one of: ${ALLOWED_MODULES.join(', ')}`,
      });
    }

    const role = await findRoleByParam(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });

    if (role.isSystemRole || role.roleName === 'Super Administrator') {
      return res.status(403).json({
        success: false,
        message: 'Super Administrator permissions cannot be turned off or modified.',
      });
    }

    role.permissions[module] = Boolean(allowed);
    await role.save();

    return res.status(200).json({
      success: true,
      message: `Permission '${module}' updated to ${role.permissions[module]}.`,
      data: role,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/roles/:id
const deleteRole = async (req, res) => {
  try {
    const role = await findRoleByParam(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.isSystemRole || role.roleName === 'Super Administrator') {
      return res.status(403).json({ success: false, message: 'Super Administrator role cannot be deleted.' });
    }

    await role.deleteOne();
    return res.status(200).json({ success: true, message: 'Role deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  toggleRolePermission,
  deleteRole,
};
