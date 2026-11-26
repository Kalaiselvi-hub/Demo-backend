const crypto = require('crypto');
const speakeasy = require('speakeasy');
const Admin = require('../models/Admin');
const Session = require('../models/Session');
const { generateToken, getClientIp } = require('../services/tokenService');

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password, rememberMe = false, totpCode } = req.body;

    const admin = await Admin.findOne({ email: email.toLowerCase() })
      .select('+password +twoFactorSecret')
      .populate('privileges');

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (admin.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(200).json({
          success: true,
          requires2FA: true,
          message: 'Two-factor authentication code is required.',
        });
      }

      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret,
        encoding: 'base32',
        token: String(totpCode).trim(),
        window: 1,
      });

      if (!verified) {
        return res.status(401).json({ success: false, message: 'Invalid 2FA verification code.' });
      }
    }

    const { token, expiresAt } = generateToken(admin._id, rememberMe);
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    await Session.create({
      admin: admin._id,
      token,
      ipAddress,
      userAgent,
      isActive: true,
      expiresAt,
    });

    admin.lastLoginAt = new Date();
    admin.lastLoginIp = ipAddress;
    await admin.save();

    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.twoFactorSecret;

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      expiresAt,
      admin: adminData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    if (req.session) {
      req.session.isActive = false;
      await req.session.save();
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during logout.', error: error.message });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'No administrator found with that email.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    admin.resetPasswordToken = hashedToken;
    admin.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await admin.save({ validateBeforeSave: false });

    const response = {
      success: true,
      message: 'Password reset instructions have been generated.',
    };

    if (process.env.NODE_ENV === 'development') {
      response.resetToken = resetToken;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error generating reset token.', error: error.message });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!admin) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    admin.password = newPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save();

    await Session.updateMany({ admin: admin._id, isActive: true }, { isActive: false });

    return res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error resetting password.', error: error.message });
  }
};

// POST /api/auth/change-password & PATCH /api/users/me/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirm password are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters with uppercase, lowercase, number and special character',
      });
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrator not found.' });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: {
        userId: `USR-${admin._id.toString().slice(-4).toUpperCase()}`,
        email: admin.email,
        updatedAt: admin.passwordChangedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update password.', error: error.message });
  }
};

// POST /api/auth/verify-current-password
const verifyCurrentPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required.' });
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    const isMatch = admin ? await admin.comparePassword(currentPassword) : false;

    return res.status(200).json({ success: true, valid: isMatch });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/auth/password-strength
const checkPasswordStrength = (req, res) => {
  const pwd = String(req.query.password || '');
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score <= 4 ? 'Good' : 'Strong';
  return res.status(200).json({ success: true, score, label });
};

module.exports = {
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyCurrentPassword,
  checkPasswordStrength,
};
