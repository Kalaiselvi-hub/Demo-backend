const Admin = require('../models/Admin');

const formatProfile = (admin) => ({
  _id: admin._id,
  userId: `USR-${admin._id.toString().slice(-4).toUpperCase()}`,
  fullName: admin.name,
  name: admin.name,
  executiveTitle: admin.jobTitle,
  title: admin.jobTitle,
  email: admin.email,
  phone: admin.directLine || '',
  phoneNumber: admin.directLine || '',
  medicalLocation: admin.location || '',
  location: admin.location || '',
  role: admin.role,
  department: admin.department,
  avatar: admin.profileImage || '',
  isActive: true,
  updatedAt: admin.updatedAt,
});

// GET /api/users/me & /api/users/profile
const getMyProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).lean();
    if (!admin) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: formatProfile(admin) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/me & PUT /api/users/me
const updateMyProfile = async (req, res) => {
  try {
    const {
      fullName,
      name,
      executiveTitle,
      title,
      jobTitle,
      email,
      phone,
      phoneNumber,
      directLine,
      medicalLocation,
      location,
    } = req.body;

    const resolvedName = (fullName ?? name ?? '').trim();
    const resolvedEmail = (email ?? '').trim().toLowerCase();
    const resolvedPhone = (phone ?? phoneNumber ?? directLine ?? '').trim();

    if (!resolvedName) {
      return res.status(400).json({ success: false, message: 'Full Administrator Name is required.' });
    }
    if (!resolvedEmail || !/^\S+@\S+\.\S+$/.test(resolvedEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!resolvedPhone) {
      return res.status(400).json({ success: false, message: 'Phone Number is required.' });
    }

    const emailInUse = await Admin.findOne({ email: resolvedEmail, _id: { $ne: req.admin._id } });
    if (emailInUse) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const updates = {
      name: resolvedName,
      email: resolvedEmail,
      directLine: resolvedPhone,
    };

    const resolvedTitle = executiveTitle ?? title ?? jobTitle;
    if (resolvedTitle !== undefined) updates.jobTitle = String(resolvedTitle).trim();

    const resolvedLocation = medicalLocation ?? location;
    if (resolvedLocation !== undefined) updates.location = String(resolvedLocation).trim();

    const updated = await Admin.findByIdAndUpdate(
      req.admin._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: formatProfile(updated),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getMyProfile, updateMyProfile };
