const express = require('express');
const {
  getInflowSummary,
  getDiagnosisBreakdown,
  getInflowAdmissions,
  exportInflowCsv,
  exportInflowPdf,
} = require('../controllers/patientInflowController');
const {
  getAppointmentLoadSummary,
  getPeakHours,
  getLoadAppointments,
  exportAppointmentLoadCsv,
  exportAppointmentLoadPdf,
} = require('../controllers/appointmentLoadController');
const {
  getFinancialSummary,
  getDepartmentContribution,
  getFinancialInvoices,
  exportFinancialCsv,
  exportFinancialPdf,
} = require('../controllers/financialRevenueController');
const {
  getProductivitySummary,
  getProductivityDoctors,
  getProductivityDoctorById,
  updateProductivityDoctorStatus,
  exportProductivityCsv,
  exportProductivityPdf,
} = require('../controllers/physicianProductivityController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'));

router.get('/patient-inflow/stats/summary', getInflowSummary);
router.get('/patient-inflow/diagnosis-breakdown', getDiagnosisBreakdown);
router.get('/patient-inflow/admissions', getInflowAdmissions);
router.get('/patient-inflow/export/csv', exportInflowCsv);
router.get('/patient-inflow/export/pdf', exportInflowPdf);

router.get('/appointment-load/stats/summary', getAppointmentLoadSummary);
router.get('/appointment-load/peak-hours', getPeakHours);
router.get('/appointment-load/appointments', getLoadAppointments);
router.get('/appointment-load/export/csv', exportAppointmentLoadCsv);
router.get('/appointment-load/export/pdf', exportAppointmentLoadPdf);

router.get('/financial-revenue/stats/summary', getFinancialSummary);
router.get('/financial-revenue/department-contribution', getDepartmentContribution);
router.get('/financial-revenue/invoices', getFinancialInvoices);
router.get('/financial-revenue/export/csv', exportFinancialCsv);
router.get('/financial-revenue/export/pdf', exportFinancialPdf);

router.get('/physician-productivity/stats/summary', getProductivitySummary);
router.get('/physician-productivity/doctors', getProductivityDoctors);
router.get('/physician-productivity/doctors/:id', getProductivityDoctorById);
router.patch('/physician-productivity/doctors/:id/status', updateProductivityDoctorStatus);
router.get('/physician-productivity/export/csv', exportProductivityCsv);
router.get('/physician-productivity/export/pdf', exportProductivityPdf);

module.exports = router;
