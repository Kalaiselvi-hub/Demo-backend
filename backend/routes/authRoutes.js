const express = require('express');
const { body } = require('express-validator');
const {
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyCurrentPassword,
  checkPasswordStrength,
} = require('../controllers/authController');
const { doctorLogin, doctorVerifyOtp } = require('../controllers/doctorPortalController');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateMiddleware');

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  login
);

router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email address is required'), validateRequest],
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validateRequest,
  ],
  resetPassword
);

router.post('/doctor-login', doctorLogin);
router.post('/doctor-verify-otp', doctorVerifyOtp);

router.post('/change-password', protect, changePassword);
router.post('/verify-current-password', protect, verifyCurrentPassword);
router.get('/password-strength', protect, checkPasswordStrength);

module.exports = router;
