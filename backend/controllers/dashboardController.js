const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Admission = require('../models/Admission');
const Facility = require('../models/Facility');
const Bed = require('../models/Bed');
const Ambulance = require('../models/Ambulance');
const BloodBank = require('../models/BloodBank');
const OperationTheater = require('../models/OperationTheater');
const Inventory = require('../models/Inventory');
const Medicine = require('../models/Medicine');
const ActivityLog = require('../models/ActivityLog');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

const formatNaira = (amount) => `₦${Number(amount || 0).toLocaleString('en-IN')}`;

const getOverviewData = async () => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalPatients,
    newPatientsThisMonth,
    newPatientsLastMonth,
    currentlyAdmitted,
    totalDoctors,
    activeDoctors,
    distinctDepts,
    aptStatusAgg,
    cancelledThisWeek,
    totalRevAgg,
    todayRevAgg,
    monthlyRevAgg,
    lastMonthRevAgg,
    todayConsultationsRaw,
    patientsAges,
    admAgg,
    disAgg,
    facilities,
    bedStats,
    deptPerfAgg,
    activityLogs,
    inventoryItems,
    lowMeds,
  ] = await Promise.all([
    Patient.countDocuments(),
    Patient.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
    Patient.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
    Admission.countDocuments({ status: 'Admitted' }),
    Doctor.countDocuments(),
    Doctor.countDocuments({ status: { $in: ['On Duty', 'Active', 'In Surgery'] } }),
    Doctor.distinct('department'),
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.countDocuments({ status: 'Cancelled', appointmentDate: { $gte: startOfWeek } }),
    Invoice.aggregate([{ $match: { paymentStatus: 'Paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Invoice.aggregate([{ $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfToday } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Invoice.aggregate([{ $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfThisMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Invoice.aggregate([{ $match: { paymentStatus: 'Paid', issuedAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Appointment.find({ appointmentDate: { $gte: startOfToday, $lte: endOfToday } })
      .populate('patient', 'name')
      .populate('doctor', 'name')
      .sort({ timeSlot: 1 })
      .lean(),
    Patient.find({}, 'age dateOfBirth').lean(),
    Admission.aggregate([
      { $match: { admissionDate: { $gte: startOfYear } } },
      { $group: { _id: { $month: '$admissionDate' }, count: { $sum: 1 } } },
    ]),
    Admission.aggregate([
      { $match: { status: 'Discharged', dischargeDate: { $gte: startOfYear, $ne: null } } },
      { $group: { _id: { $month: '$dischargeDate' }, count: { $sum: 1 } } },
    ]),
    Facility.find({ isActive: { $ne: false } }).lean(),
    Bed.aggregate([{ $group: { _id: { facility: '$facility', status: '$status' }, count: { $sum: 1 } } }]),
    Appointment.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 4 }]),
    ActivityLog.find().sort({ createdAt: -1 }).limit(5).lean(),
    Inventory.find({ $expr: { $lte: ['$stock', '$reorderLevel'] } }).sort({ stock: 1 }).limit(5).lean(),
    Medicine.find({ isActive: { $ne: false }, $expr: { $lt: ['$stockLevel', '$reorderAt'] } }).sort({ stockLevel: 1 }).limit(5).lean(),
  ]);

  const patGrowthNum =
    newPatientsLastMonth === 0
      ? newPatientsThisMonth > 0 ? 100 : 0
      : Number((((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100).toFixed(1));
  const patientsGrowth = `${patGrowthNum >= 0 ? '+' : ''}${patGrowthNum}%`;

  const aptMap = new Map(aptStatusAgg.map((a) => [a._id, a.count]));
  const totalAppointments = aptStatusAgg.reduce((s, a) => s + a.count, 0);
  const appointmentsPending = (aptMap.get('Pending') || 0) + (aptMap.get('Scheduled') || 0);
  const appointmentsDone = (aptMap.get('Completed') || 0) + (aptMap.get('Done') || 0);

  const totalRevenue = totalRevAgg[0]?.total || 0;
  const todayCollection = todayRevAgg[0]?.total || 0;
  const mRev = monthlyRevAgg[0]?.total || 0;
  const lmRev = lastMonthRevAgg[0]?.total || 0;
  const revGrowthNum =
    lmRev === 0 ? (mRev > 0 ? 100 : 0) : Number((((mRev - lmRev) / lmRev) * 100).toFixed(1));
  const revenueGrowth = `${revGrowthNum >= 0 ? '+' : ''}${revGrowthNum}%`;

  const todayConsultations = todayConsultationsRaw.map((a) => ({
    _id: a._id,
    aptId: a.appointmentId,
    patientName: a.patientFullName || a.patient?.name || 'Patient',
    doctorName: a.consultingPhysician || a.doctor?.name || 'Doctor',
    department: a.department,
    time: a.timeSlot,
    status: a.status,
  }));

  const buckets = [
    { label: '0-17 Yrs (Pediatric)', value: 0 },
    { label: '18-35 Yrs (Young Adults)', value: 0 },
    { label: '36-55 Yrs (Adults)', value: 0 },
    { label: '55+ Yrs (Seniors)', value: 0 },
  ];
  for (const p of patientsAges) {
    let age = p.age || 0;
    if (p.dateOfBirth) {
      const dob = new Date(p.dateOfBirth);
      age = now.getFullYear() - dob.getFullYear();
    }
    if (age <= 17) buckets[0].value++;
    else if (age <= 35) buckets[1].value++;
    else if (age <= 55) buckets[2].value++;
    else buckets[3].value++;
  }
  const demographics = {
    total: totalPatients,
    groups: buckets.map((b) => ({
      label: b.label,
      value: b.value,
      percentage: totalPatients === 0 ? 0 : Math.round((b.value / totalPatients) * 100),
    })),
  };

  const admMap = new Map(admAgg.map((a) => [a._id, a.count]));
  const disMap = new Map(disAgg.map((d) => [d._id, d.count]));
  const admissionsVsDischarges = MONTH_NAMES.map((month, idx) => ({
    month,
    admissions: admMap.get(idx + 1) || 0,
    discharges: disMap.get(idx + 1) || 0,
  }));

  const occMap = new Map();
  for (const b of bedStats) {
    if (b._id.status === 'Occupied' && b._id.facility) {
      occMap.set(b._id.facility.toString(), b.count);
    }
  }
  const facilityCapacity = facilities.map((f) => {
    const total = f.totalBeds || f.totalCapacity || 0;
    const occupied = occMap.get(f._id.toString()) || f.currentLoad || 0;
    const percentage = total === 0 ? 0 : Math.round((occupied / total) * 100);
    return { name: f.name, occupied, total, percentage };
  });

  const departmentPerformance = deptPerfAgg.map((d) => ({
    name: d._id || 'General',
    percentage: totalAppointments === 0 ? 0 : Math.round((d.count / totalAppointments) * 100),
  }));

  const recentActivities = activityLogs.map((l) => ({
    message: l.message,
    time: l.time || 'Recently',
    type: l.type,
  }));

  const inventoryAlerts =
    inventoryItems.length > 0
      ? inventoryItems.map((i) => ({
          name: i.name,
          stock: i.stock,
          status: i.stock === 0 ? 'Out of Stock' : 'Low Stock',
          action: i.stock === 0 ? 'Urgent' : 'Reorder',
        }))
      : lowMeds.map((m) => ({
          name: m.medicationName,
          stock: m.stockLevel,
          status: m.stockLevel === 0 ? 'Out of Stock' : 'Low Stock',
          action: m.stockLevel === 0 ? 'Urgent' : 'Reorder',
        }));

  return {
    totalPatients,
    currentlyAdmitted,
    patientsGrowth,
    totalDoctors,
    activeDoctors,
    departmentsCount: distinctDepts.length,
    totalAppointments,
    appointmentsPending,
    appointmentsDone,
    appointmentsCancelled: cancelledThisWeek,
    totalRevenue,
    revenueFormatted: formatNaira(totalRevenue),
    todayCollection,
    revenueGrowth,
    todayConsultations,
    demographics,
    admissionsVsDischarges,
    facilityCapacity,
    departmentPerformance,
    recentActivities,
    inventoryAlerts,
  };
};

// 1. GET /api/dashboard/overview
const getOverview = async (req, res) => {
  try {
    const data = await getOverviewData();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. GET /api/dashboard/quick-stats
const getQuickStats = async (req, res) => {
  try {
    const ov = await getOverviewData();
    return res.status(200).json({
      success: true,
      data: {
        totalPatients: ov.totalPatients,
        currentlyAdmitted: ov.currentlyAdmitted,
        patientsGrowth: ov.patientsGrowth,
        totalDoctors: ov.totalDoctors,
        activeDoctors: ov.activeDoctors,
        departmentsCount: ov.departmentsCount,
        totalAppointments: ov.totalAppointments,
        appointmentsPending: ov.appointmentsPending,
        appointmentsDone: ov.appointmentsDone,
        appointmentsCancelled: ov.appointmentsCancelled,
        totalRevenue: ov.totalRevenue,
        revenueFormatted: ov.revenueFormatted,
        todayCollection: ov.todayCollection,
        revenueGrowth: ov.revenueGrowth,
        admissionsVsDischarges: ov.admissionsVsDischarges,
        demographicsRatio: ov.demographics,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. GET /api/dashboard/live-status
const getLiveStatus = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [icuFac, icuBeds, ambulances, bloodRows, ots, scansToday] = await Promise.all([
      Facility.findOne({ name: /ICU/i }).lean(),
      Bed.find().lean(),
      Ambulance.find().lean(),
      BloodBank.find().lean(),
      OperationTheater.find().lean(),
      Appointment.countDocuments({ department: /Radiology|Imaging|Diagnostic/i, appointmentDate: { $gte: startOfToday } }),
    ]);

    const icuFiltered = icuFac
      ? icuBeds.filter((b) => b.facility && b.facility.toString() === icuFac._id.toString())
      : [];
    const icuTotal = icuFiltered.length || icuFac?.totalBeds || 0;
    const icuOccupied = icuFiltered.filter((b) => b.status === 'Occupied').length;
    const icuAvailable = Math.max(0, icuTotal - icuOccupied);
    const ventilatorsTotal = icuFiltered.filter((b) => b.ventilatorConnected).length;
    const ventilatorsInUse = icuFiltered.filter((b) => b.ventilatorConnected && b.status === 'Occupied').length;
    const reserveBeds = icuFiltered.filter((b) => b.isEmergencyReserve).length;
    const icuPct = icuTotal === 0 ? 0 : (icuOccupied / icuTotal) * 100;
    const icuStatus = icuPct >= 80 ? 'Critical' : icuPct >= 60 ? 'High Occupancy' : 'Normal';

    const ambTotal = ambulances.length;
    const standby = ambulances.filter((a) => a.status === 'Available' || a.status === 'Standby').length;
    const onTransit = ambulances.filter((a) => a.status === 'Active' || a.status === 'OnTransit').length;

    const bloodTotal = bloodRows.reduce((s, b) => s + (b.units || 0), 0);
    const abNeg = bloodRows.find((b) => b.bloodGroup === 'AB-')?.units || 0;

    return res.status(200).json({
      success: true,
      data: {
        icu: {
          totalBeds: icuTotal,
          occupied: icuOccupied,
          available: icuAvailable,
          ventilatorsTotal,
          ventilatorsInUse,
          reserveBeds,
          status: icuStatus,
        },
        emergencyTriage: { totalBeds: 6, occupied: 4, available: 2, totalPatients: 12, averageWaitMinutes: 12 },
        ambulanceFleet: { total: ambTotal, standby, onTransit, gpsActive: true, urgentTransfers: onTransit },
        bloodBank: { totalUnits: bloodTotal, abNegative: abNeg, status: abNeg < 5 ? 'AB- Needed' : 'Optimal' },
        operationTheaters: {
          total: ots.length,
          active: ots.filter((o) => o.status === 'Active').length,
          scheduled: ots.filter((o) => o.status === 'Scheduled').length,
          sterile: ots.filter((o) => o.status === 'Sterile').length,
        },
        diagnosticImaging: { scansToday, mri: 'Available', ct: 'Available', xray: 'Available' },
        departments: [
          { name: 'Intensive Care Unit (ICU)', beds: icuTotal, occupied: icuOccupied, status: 'Operational' },
          { name: 'Operation Theaters (4 Suites)', active: ots.filter((o) => o.status === 'Active').length, status: 'Operational' },
          { name: 'Automated Blood Bank', units: bloodTotal, status: abNeg < 5 ? 'AB- Needed' : 'Optimal' },
          { name: 'Diagnostic Imaging Center', scansToday, status: 'Operational' },
          { name: 'Emergency & Triage Bay', beds: 6, occupied: 4, status: 'Operational' },
          { name: 'Mobile Ambulance Fleet', total: ambTotal, standby, status: 'GPS Active' },
        ],
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. GET /api/dashboard/today-consultations
const getTodayConsultations = async (req, res) => {
  try {
    const ov = await getOverviewData();
    return res.status(200).json({ success: true, data: ov.todayConsultations });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. GET /api/dashboard/activities
const getRecentActivities = async (req, res) => {
  try {
    const ov = await getOverviewData();
    return res.status(200).json({ success: true, data: ov.recentActivities });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. GET /api/dashboard/inventory-alerts
const getInventoryAlerts = async (req, res) => {
  try {
    const ov = await getOverviewData();
    return res.status(200).json({ success: true, data: ov.inventoryAlerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOverview,
  getLiveStatus,
  getQuickStats,
  getTodayConsultations,
  getRecentActivities,
  getInventoryAlerts,
};
