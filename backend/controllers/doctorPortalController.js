const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const DoctorPortalAccess = require('../models/DoctorPortalAccess');
const Doctor = require('../models/Doctor');

// GET /api/doctors/portal-access
const getAllPortalAccess = async (req, res) => {
  try {
    const records = await DoctorPortalAccess.find().sort({ doctorId: 1 }).lean();
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch portal access records.', error: error.message });
  }
};

// GET /api/doctors/portal-access/:doctorId
const getPortalAccessByDoctorId = async (req, res) => {
  try {
    const record = await DoctorPortalAccess.findOne({ doctorId: req.params.doctorId }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Portal access record not found.' });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/doctors/portal-access
const createPortalAccess = async (req, res) => {
  try {
    const { doctorId, username, securityRole, password, twoFactorAuth, fullName, email } = req.body;
    const doctor = await Doctor.findOne({ doctorId });
    if (!doctor && (!fullName || !email)) {
      return res.status(404).json({ success: false, message: 'Doctor not found for the given doctorId.' });
    }

    const existingUser = await DoctorPortalAccess.findOne({
      $or: [{ doctorId }, { username: String(username).toLowerCase() }],
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Portal access or username already exists.' });
    }

    const created = await DoctorPortalAccess.create({
      doctor: doctor?._id,
      doctorId,
      fullName: doctor?.name || fullName,
      email: doctor?.email || email,
      username,
      passwordHash: password,
      securityRole,
      twoFactorAuth: twoFactorAuth || { enabled: false, method: 'OTP' },
    });

    const safeData = created.toObject();
    delete safeData.passwordHash;
    return res.status(201).json({ success: true, message: 'Doctor portal access created.', data: safeData });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/doctors/portal-access/:id
const updatePortalAccess = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.passwordHash;
    const updated = await DoctorPortalAccess.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Portal access record not found.' });
    return res.status(200).json({ success: true, message: 'Portal access updated.', data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/doctors/portal-access/:id/suspend
const suspendPortalAccess = async (req, res) => {
  try {
    const updated = await DoctorPortalAccess.findByIdAndUpdate(
      req.params.id,
      { $set: { accountStatus: 'Suspended' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Portal access record not found.' });
    return res.status(200).json({ success: true, message: 'Doctor portal account suspended.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/doctors/portal-access/:id/activate
const activatePortalAccess = async (req, res) => {
  try {
    const updated = await DoctorPortalAccess.findByIdAndUpdate(
      req.params.id,
      { $set: { accountStatus: 'Active' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Portal access record not found.' });
    return res.status(200).json({ success: true, message: 'Doctor portal account activated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/doctors/portal-access/:id/toggle-2fa
const togglePortal2FA = async (req, res) => {
  try {
    const record = await DoctorPortalAccess.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Portal access record not found.' });

    record.twoFactorAuth.enabled = !record.twoFactorAuth.enabled;
    await record.save();

    return res.status(200).json({
      success: true,
      message: `Two-factor authentication ${record.twoFactorAuth.enabled ? 'enabled' : 'disabled'}.`,
      data: record,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/doctors/portal-access/:id/reset-password
const resetPortalPassword = async (req, res) => {
  try {
    const record = await DoctorPortalAccess.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Portal access record not found.' });

    const tempPassword = `Naira#${crypto.randomBytes(3).toString('hex')}`;
    const resetToken = crypto.randomBytes(20).toString('hex');

    record.passwordHash = tempPassword;
    record.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    record.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await record.save();

    const response = {
      success: true,
      message: 'Temporary password generated successfully.',
    };
    if (process.env.NODE_ENV === 'development') {
      response.temporaryPassword = tempPassword;
      response.resetToken = resetToken;
    }
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/doctor-login
const doctorLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const portalUser = await DoctorPortalAccess.findOne({ username: username.toLowerCase() }).select('+passwordHash');
    if (!portalUser) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (portalUser.accountStatus === 'Suspended') {
      return res.status(403).json({ success: false, message: 'Account Suspended. Contact Admin.' });
    }

    const isMatch = await portalUser.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (portalUser.twoFactorAuth?.enabled) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      portalUser.otpCode = otp;
      portalUser.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      await portalUser.save();

      const resp = {
        success: true,
        requires2FA: true,
        message: 'OTP sent. Please verify to complete login.',
      };
      if (process.env.NODE_ENV === 'development') resp.devOtp = otp;
      return res.status(200).json(resp);
    }

    portalUser.lastPortalAccess = new Date();
    await portalUser.save();

    const token = jwt.sign(
      { id: portalUser._id, doctorId: portalUser.doctorId, role: portalUser.securityRole, type: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const safeUser = portalUser.toObject();
    delete safeUser.passwordHash;
    return res.status(200).json({ success: true, message: 'Doctor login successful.', token, doctor: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/doctor-verify-otp
const doctorVerifyOtp = async (req, res) => {
  try {
    const { username, otp } = req.body;
    const portalUser = await DoctorPortalAccess.findOne({ username: String(username || '').toLowerCase() }).select('+otpCode +otpExpiry');

    if (!portalUser || !portalUser.otpCode || portalUser.otpCode !== String(otp).trim() || portalUser.otpExpiry < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    portalUser.otpCode = undefined;
    portalUser.otpExpiry = undefined;
    portalUser.lastPortalAccess = new Date();
    await portalUser.save();

    const token = jwt.sign(
      { id: portalUser._id, doctorId: portalUser.doctorId, role: portalUser.securityRole, type: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const safeUser = portalUser.toObject();
    delete safeUser.otpCode;
    delete safeUser.otpExpiry;
    return res.status(200).json({ success: true, message: 'OTP verified. Login successful.', token, doctor: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllPortalAccess,
  getPortalAccessByDoctorId,
  createPortalAccess,
  updatePortalAccess,
  suspendPortalAccess,
  activatePortalAccess,
  togglePortal2FA,
  resetPortalPassword,
  doctorLogin,
  doctorVerifyOtp,
};
