const jwt = require('jsonwebtoken');

const generateToken = (adminId, rememberMe = false) => {
  const expiresIn = rememberMe
    ? process.env.JWT_REMEMBER_EXPIRES_IN || '30d'
    : process.env.JWT_EXPIRES_IN || '1d';

  const token = jwt.sign({ id: adminId }, process.env.JWT_SECRET, { expiresIn });

  const days = rememberMe ? 30 : 1;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return { token, expiresAt };
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
};

module.exports = { generateToken, getClientIp };
