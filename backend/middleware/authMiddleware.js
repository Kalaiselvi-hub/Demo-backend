const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Session = require('../models/Session');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await Session.findOne({
      token,
      admin: decoded.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired or revoked. Please log in again.' });
    }

    const admin = await Admin.findById(decoded.id).populate('privileges');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Administrator account not found.' });
    }

    session.lastActivityAt = new Date();
    await session.save();

    req.admin = admin;
    req.session = session;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized. Invalid or expired token.' });
  }
};

const authorizePrivileges = (...requiredPrivileges) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const adminPrivilegeNames = (req.admin.privileges || [])
      .filter((p) => p.isActive !== false)
      .map((p) => p.name);

    const isSuperAdmin =
      req.admin.role === 'Super Administrator' ||
      adminPrivilegeNames.includes('Super Administrator');

    if (isSuperAdmin) {
      return next();
    }

    const hasPrivilege = requiredPrivileges.some((priv) => adminPrivilegeNames.includes(priv));
    if (!hasPrivilege) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have the required privileges for this action.',
      });
    }

    next();
  };
};

module.exports = { protect, authorizePrivileges };
