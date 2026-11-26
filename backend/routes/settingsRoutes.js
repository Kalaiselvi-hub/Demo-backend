const express = require('express');
const { getLocalization, updateLocalization, resetLocalization } = require('../controllers/localizationController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/localization', getLocalization);
router.get('/system', getLocalization);
router.patch('/localization', authorizePrivileges('Super Administrator', 'Clinical Administration'), updateLocalization);
router.put('/localization', authorizePrivileges('Super Administrator', 'Clinical Administration'), updateLocalization);
router.post('/localization/reset', authorizePrivileges('Super Administrator', 'Clinical Administration'), resetLocalization);

module.exports = router;
