const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Admission = require('../models/Admission');
const Department = require('../models/Department');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const computeKpiTotalPatients = async () => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totalPatients, newThisMonth, newLastMonth, currentlyAdmitted] = await Promise.all([
    Patient.countDocuments(),
    Patient.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
    Patient.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
    Admission.countDocuments({ status: 'Admitted' }),
  ]);

  const growthPercentage =
    newLastMonth === 0
      ? newThisMonth > 0
        ? 100
        : 0
      : Number((((newThisMonth - newLastMonth) / newLastMonth) * 100).toFixed(1));

  return {
    totalPatients,
    growthPercentage,
    currentlyAdmitted,
  };
};

const computeKpiTotalDoctors = async () => {
  const [totalDoctors, specialistsOnActiveDuty, totalDepartments, distinctDoctorDepts] = await Promise.all([
    Doctor.countDocuments(),
    Doctor.countDocuments({ status: 'Active' }),
    Department.countDocuments(),
    Doctor.distinct('department'),
  ]);

  return {
    totalDoctors,
    totalDepartments: totalDepartments || distinctDoctorDepts.length,
    coverage: '24/7 Coverage',
    specialistsOnActiveDuty,
  };
};

const computeKpiAppointmentsSummary = async () => {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const [statusAgg, cancelledThisWeek] = await Promise.all([
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.countDocuments({ status: 'Cancelled', updatedAt: { $gte: startOfWeek } }),
  ]);

  const counts = {};
  let totalAppointments = 0;
  for (const item of statusAgg) {
    counts[item._id] = item.count;
    totalAppointments += item.count;
  }

  return {
    totalAppointments,
    pendingAppointments: counts['Pending'] || 0,
    doneAppointments: counts['Completed'] || 0,
    cancelledThisWeek,
  };
};

const computeKpiRevenue = async () => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalAgg, monthlyAgg, lastMonthAgg, todayAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Invoice.aggregate([
      { $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Invoice.aggregate([
      { $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Invoice.aggregate([
      { $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  const totalRevenue = totalAgg[0]?.total || 0;
  const monthlyRevenue = monthlyAgg[0]?.total || 0;
  const lastMonthRevenue = lastMonthAgg[0]?.total || 0;
  const todaysCollection = todayAgg[0]?.total || 0;

  const growthPercentage =
    lastMonthRevenue === 0
      ? monthlyRevenue > 0
        ? 100
        : 0
      : Number((((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1));

  return {
    currency: '₦',
    currencyCode: 'NGN',
    totalRevenue,
    growthPercentage,
    todaysCollection,
  };
};

const computeKpiAdmissionsDischarges = async (year) => {
  const targetYear = Number(year) || new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  const [admissionsAgg, dischargesAgg] = await Promise.all([
    Admission.aggregate([
      { $match: { admissionDate: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { $month: '$admissionDate' }, count: { $sum: 1 } } },
    ]),
    Admission.aggregate([
      { $match: { status: 'Discharged', dischargeDate: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: { _id: { $month: '$dischargeDate' }, count: { $sum: 1 } } },
    ]),
  ]);

  const admMap = new Map(admissionsAgg.map((a) => [a._id, a.count]));
  const disMap = new Map(dischargesAgg.map((d) => [d._id, d.count]));

  const data = MONTH_NAMES.map((month, idx) => ({
    month,
    admissions: admMap.get(idx + 1) || 0,
    discharges: disMap.get(idx + 1) || 0,
  }));

  return { year: targetYear, data };
};

const computeKpiDemographicsRatio = async () => {
  const now = new Date();
  const patients = await Patient.find({}, 'age dateOfBirth').lean();
  const totalPatients = patients.length;

  const buckets = {
    '0-17 years': 0,
    '18-35 years': 0,
    '36-55 years': 0,
    '56+ years': 0,
  };

  for (const p of patients) {
    let age = p.age;
    if (p.dateOfBirth) {
      const dob = new Date(p.dateOfBirth);
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        age--;
      }
    }
    if (age <= 17) buckets['0-17 years']++;
    else if (age <= 35) buckets['18-35 years']++;
    else if (age <= 55) buckets['36-55 years']++;
    else buckets['56+ years']++;
  }

  const demographics = Object.entries(buckets).map(([category, count]) => ({
    category,
    count,
    percentage: totalPatients === 0 ? 0 : Number(((count / totalPatients) * 100).toFixed(2)),
  }));

  return { totalPatients, demographics };
};

// Route Handlers
const getKpiTotalPatients = async (req, res) => {
  try {
    const data = await computeKpiTotalPatients();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiTotalDoctors = async (req, res) => {
  try {
    const data = await computeKpiTotalDoctors();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiAppointmentsSummary = async (req, res) => {
  try {
    const data = await computeKpiAppointmentsSummary();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiRevenue = async (req, res) => {
  try {
    const data = await computeKpiRevenue();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiAdmissionsDischarges = async (req, res) => {
  try {
    const data = await computeKpiAdmissionsDischarges(req.query.year);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiDemographicsRatio = async (req, res) => {
  try {
    const data = await computeKpiDemographicsRatio();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getKpiOverview = async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [
      totalPatients,
      totalDoctors,
      appointmentsSummary,
      revenue,
      admissionsDischarges,
      demographicsRatio,
    ] = await Promise.all([
      computeKpiTotalPatients(),
      computeKpiTotalDoctors(),
      computeKpiAppointmentsSummary(),
      computeKpiRevenue(),
      computeKpiAdmissionsDischarges(year),
      computeKpiDemographicsRatio(),
    ]);

    return res.status(200).json({
      success: true,
      kpi: {
        totalPatients,
        totalDoctors,
        appointmentsSummary,
        revenue,
        admissionsDischarges,
        demographicsRatio,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getKpiTotalPatients,
  getKpiTotalDoctors,
  getKpiAppointmentsSummary,
  getKpiRevenue,
  getKpiAdmissionsDischarges,
  getKpiDemographicsRatio,
  getKpiOverview,
};
