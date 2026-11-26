const express = require('express');
const {
  getOverview,
  getLiveStatus,
  getQuickStats,
  getTodayConsultations,
  getRecentActivities,
  getInventoryAlerts,
} = require('../controllers/dashboardController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Super Administrator', 'Clinical Administration', 'Full EMR Access'));

router.get('/overview', getOverview);
router.get('/live-status', getLiveStatus);
router.get('/quick-stats', getQuickStats);
router.get('/today-consultations', getTodayConsultations);
router.get('/activities', getRecentActivities);
router.get('/inventory-alerts', getInventoryAlerts);

module.exports = router;
