const express = require('express');
const {
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
} = require('../controllers/adminController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.patch('/profile/image', updateProfileImage);

// Security & 2FA
router.get('/security', getSecuritySummary);
router.post('/2fa/enable', enable2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', disable2FA);

// Sessions
router.get('/sessions', getSessions);
router.delete('/sessions/:id', revokeSession);

// Privileges (RBAC)
router.get('/privileges', getPrivileges);
router.put('/privileges', authorizePrivileges('Super Administrator'), updatePrivileges);

module.exports = router;
