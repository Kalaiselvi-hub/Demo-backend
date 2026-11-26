const express = require('express');
const {
  getIcuStatus,
  getEmergencyTriage,
  getAmbulanceFleet,
  getDepartmentsLive,
  getLiveStatus,
} = require('../controllers/operationalController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Super Administrator', 'Clinical Administration', 'Full EMR Access'));

router.get('/live-status', getLiveStatus);
router.get('/icu-status', getIcuStatus);
router.get('/emergency-triage', getEmergencyTriage);
router.get('/ambulance-fleet', getAmbulanceFleet);
router.get('/departments-live', getDepartmentsLive);

module.exports = router;
