const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const Admin = require('../models/Admin');
const Session = require('../models/Session');
const Privilege = require('../models/Privilege');

// GET /api/admin/profile
const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).populate('privileges');
    return res.status(200).json({ success: true, profile: admin });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile.', error: error.message });
  }
};

// PUT /api/admin/profile
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'name',
      'jobTitle',
      'department',
      'email',
      'directLine',
      'hospitalCentre',
      'location',
      'role',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.admin._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('privileges');

    return res.status(200).json({
      success: true,
      message: 'Administrator profile updated successfully.',
      profile: updatedAdmin,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/profile/image
const updateProfileImage = async (req, res) => {
  try {
    const { profileImage } = req.body;
    if (!profileImage) {
      return res.status(400).json({ success: false, message: 'Profile image URL or data is required.' });
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.admin._id,
      { $set: { profileImage } },
      { new: true }
    ).populate('privileges');

    return res.status(200).json({
      success: true,
      message: 'Profile image updated successfully.',
      profile: updatedAdmin,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update profile image.', error: error.message });
  }
};

// GET /api/admin/security
const getSecuritySummary = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).populate('privileges');
    const activeSessions = await Session.find({
      admin: req.admin._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .select('-token')
      .sort({ lastActivityAt: -1 });

    return res.status(200).json({
      success: true,
      security: {
        twoFactorEnabled: admin.twoFactorEnabled,
        activeSessionStatus: activeSessions.length > 0 ? 'Active' : 'Inactive',
        activeSessionCount: activeSessions.length,
        currentSessionId: req.session?._id,
        lastLoginIp: admin.lastLoginIp || req.session?.ipAddress || 'Unknown',
        lastLoginAt: admin.lastLoginAt,
        activePrivileges: admin.privileges,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load security summary.', error: error.message });
  }
};

// POST /api/admin/2fa/enable
const enable2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `NAIRA Hospital CRM (${req.admin.email})`,
      issuer: 'NAIRA Multi-Speciality Hospital',
    });

    await Admin.findByIdAndUpdate(req.admin._id, {
      twoFactorSecret: secret.base32,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      message: 'Scan the QR code with Google Authenticator and verify to enable 2FA.',
      qrCode: qrCodeDataUrl,
      manualEntryKey: secret.base32,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to initialize 2FA.', error: error.message });
  }
};

// POST /api/admin/2fa/verify
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const admin = await Admin.findById(req.admin._id).select('+twoFactorSecret');
    if (!admin.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA has not been initialized.' });
    }

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid TOTP verification code.' });
    }

    admin.twoFactorEnabled = true;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Two-Factor Authentication enabled successfully.',
      twoFactorEnabled: true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to verify 2FA.', error: error.message });
  }
};

// POST /api/admin/2fa/disable
const disable2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+twoFactorSecret');

    if (!admin.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is already disabled.' });
    }

    if (token) {
      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret,
        encoding: 'base32',
        token: String(token).trim(),
        window: 1,
      });
      if (!verified) {
        return res.status(400).json({ success: false, message: 'Invalid TOTP verification code.' });
      }
    }

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = undefined;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Two-Factor Authentication disabled.',
      twoFactorEnabled: false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to disable 2FA.', error: error.message });
  }
};

// GET /api/admin/sessions
const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      admin: req.admin._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .select('-token')
      .sort({ lastActivityAt: -1 });

    const formatted = sessions.map((s) => ({
      ...s.toObject(),
      isCurrent: req.session && s._id.toString() === req.session._id.toString(),
    }));

    return res.status(200).json({ success: true, sessions: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch sessions.', error: error.message });
  }
};

// DELETE /api/admin/sessions/:id
const revokeSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, admin: req.admin._id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    session.isActive = false;
    await session.save();

    return res.status(200).json({ success: true, message: 'Session revoked successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to revoke session.', error: error.message });
  }
};

// GET /api/admin/privileges
const getPrivileges = async (req, res) => {
  try {
    const allPrivileges = await Privilege.find().sort({ name: 1 });
    const admin = await Admin.findById(req.admin._id).populate('privileges');

    return res.status(200).json({
      success: true,
      allPrivileges,
      assignedPrivileges: admin.privileges,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch privileges.', error: error.message });
  }
};

// PUT /api/admin/privileges
const updatePrivileges = async (req, res) => {
  try {
    const { privilegeIds, adminId } = req.body;
    const targetAdminId = adminId || req.admin._id;

    if (!Array.isArray(privilegeIds)) {
      return res.status(400).json({ success: false, message: 'privilegeIds must be an array.' });
    }

    const validPrivileges = await Privilege.find({ _id: { $in: privilegeIds } });
    if (validPrivileges.length !== privilegeIds.length) {
      return res.status(400).json({ success: false, message: 'One or more privilege IDs are invalid.' });
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      targetAdminId,
      { $set: { privileges: privilegeIds } },
      { new: true }
    ).populate('privileges');

    if (!updatedAdmin) {
      return res.status(404).json({ success: false, message: 'Target administrator not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Administrator privileges updated successfully.',
      privileges: updatedAdmin.privileges,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update privileges.', error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateProfileImage,
  getSecuritySummary,
  enable2FA,
  verify2FA,
  disable2FA,
  getSessions,
  revokeSession,
  getPrivileges,
  updatePrivileges,
};
