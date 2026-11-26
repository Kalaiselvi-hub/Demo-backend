const express = require('express');
const {
  getKpiTotalPatients,
  getKpiTotalDoctors,
  getKpiAppointmentsSummary,
  getKpiRevenue,
  getKpiAdmissionsDischarges,
  getKpiDemographicsRatio,
  getKpiOverview,
} = require('../controllers/kpiController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Super Administrator', 'Clinical Administration', 'Full EMR Access'));

router.get('/overview', getKpiOverview);
router.get('/total-patients', getKpiTotalPatients);
router.get('/total-doctors', getKpiTotalDoctors);
router.get('/appointments-summary', getKpiAppointmentsSummary);
router.get('/revenue', getKpiRevenue);
router.get('/admissions-discharges', getKpiAdmissionsDischarges);
router.get('/demographics-ratio', getKpiDemographicsRatio);

module.exports = router;
