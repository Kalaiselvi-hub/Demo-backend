const express = require('express');
const {
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  updateFacilityStatus,
} = require('../controllers/facilityController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getFacilities);
router.get('/:id', getFacilityById);
router.post('/', authorizePrivileges('Clinical Administration', 'Super Administrator'), createFacility);
router.put('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateFacility);
router.patch('/:id/status', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateFacilityStatus);

module.exports = router;
