const express = require('express');
const { getMyProfile, updateMyProfile } = require('../controllers/userController');
const { changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/me', getMyProfile);
router.get('/profile', getMyProfile);
router.patch('/me', updateMyProfile);
router.put('/me', updateMyProfile);
router.patch('/me/password', changePassword);

module.exports = router;
