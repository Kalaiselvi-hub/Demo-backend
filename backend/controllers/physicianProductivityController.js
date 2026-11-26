const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Feedback = require('../models/Feedback');

const getPeriodBounds = (period = 'this-month') => {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let label = 'This Month';

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = 'Today';
  } else if (period === 'this-week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    label = 'This Week';
  } else if (period === 'this-quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1);
    label = 'This Quarter';
  } else if (period.startsWith('year-')) {
    const yr = Number(period.split('-')[1]) || now.getFullYear();
    start = new Date(yr, 0, 1);
    label = `Year ${yr}`;
  }

  return { start, end: now, label };
};

const computeDoctorsProductivity = async ({ period = 'this-month', department = '', status = '', search = '' }) => {
  const { start, end } = getPeriodBounds(period);
  const docFilter = {};
  if (department && department !== 'All') docFilter.department = new RegExp(department.trim(), 'i');
  if (status && status !== 'All') docFilter.status = status;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    docFilter.$or = [{ name: regex }, { specialization: regex }, { doctorId: regex }];
  }

  const [doctors, aptAgg, feedbackAgg] = await Promise.all([
    Doctor.find(docFilter).sort({ doctorId: 1, name: 1 }).lean(),
    Appointment.aggregate([
      { $match: { appointmentDate: { $gte: start, $lte: end }, status: 'Completed' } },
      { $group: { _id: '$doctor', consultations: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $match: { isVerified: true, date: { $gte: start, $lte: end } } },
      { $group: { _id: '$doctor', avgRating: { $avg: '$rating' } } },
    ]),
  ]);

  const aptMap = new Map(aptAgg.filter((a) => a._id).map((a) => [a._id.toString(), a.consultations]));
  const fbMap = new Map(feedbackAgg.filter((f) => f._id).map((f) => [f._id.toString(), f.avgRating]));

  return doctors.map((d) => {
    const consultations = aptMap.get(d._id.toString()) || 0;
    const ratingVal = Number((fbMap.get(d._id.toString()) ?? d.rating ?? 4.8).toFixed(1));
    const avgWaitTime = 12;

    return {
      _id: d._id,
      doctorId: d.doctorId || d._id.toString().slice(-6).toUpperCase(),
      doctorName: d.name,
      title: d.title || d.specialization,
      department: d.department,
      consultations,
      surgeries: 0,
      patientRating: ratingVal,
      patientRatingLabel: `${ratingVal.toFixed(1)} / 5.0`,
      avgWaitTime,
      avgWaitTimeLabel: `${avgWaitTime} mins`,
      status: d.status,
    };
  });
};

// GET /api/reports/physician-productivity/stats/summary
const getProductivitySummary = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const { label } = getPeriodBounds(period);
    const list = await computeDoctorsProductivity({ period });

    const totalDoctors = list.length;
    const totalConsultations = list.reduce((s, d) => s + d.consultations, 0);
    const totalSurgeries = list.reduce((s, d) => s + d.surgeries, 0);
    const averageRating =
      totalDoctors === 0
        ? 0
        : Number((list.reduce((s, d) => s + d.patientRating, 0) / totalDoctors).toFixed(2));
    const onDutyCount = list.filter((d) => d.status === 'On Duty' || d.status === 'Active').length;
    const inSurgeryCount = list.filter((d) => d.status === 'In Surgery').length;

    return res.status(200).json({
      success: true,
      data: {
        totalDoctors,
        totalConsultations,
        totalSurgeries,
        averageRating,
        averageWaitTime: 12,
        onDutyCount,
        inSurgeryCount,
        reportingPeriod: label,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/physician-productivity/doctors
const getProductivityDoctors = async (req, res) => {
  try {
    const { period = 'this-month', department = '', status = '', search = '' } = req.query;
    const data = await computeDoctorsProductivity({ period, department, status, search });
    return res.status(200).json({ success: true, total: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/physician-productivity/doctors/:id
const getProductivityDoctorById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { doctorId: req.params.id.toUpperCase() };

    const doc = await Doctor.findOne(filter).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/reports/physician-productivity/doctors/:id/status
const updateProductivityDoctorStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['On Duty', 'In Surgery', 'Off Duty', 'On Leave'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { doctorId: req.params.id.toUpperCase() };

    const doc = await Doctor.findOneAndUpdate(filter, { $set: { status } }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, message: 'Doctor status updated.', data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/physician-productivity/export/csv
const exportProductivityCsv = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const data = await computeDoctorsProductivity({ period });
    const headers = ['Doctor ID', 'Doctor Name', 'Department', 'Consultations', 'Surgeries', 'Rating', 'Avg Wait', 'Status'];
    const rows = data.map((d) =>
      [d.doctorId, d.doctorName, d.department, d.consultations, d.surgeries, d.patientRatingLabel, d.avgWaitTimeLabel, d.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="physician-productivity-report.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/physician-productivity/export/pdf
const exportProductivityPdf = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const data = await computeDoctorsProductivity({ period });
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - PHYSICIAN PRODUCTIVITY & CLINICAL RATINGS',
      `Period: ${period}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      ...data.map((d) => `${d.doctorName} (${d.department}) | Consultations: ${d.consultations} | Rating: ${d.patientRatingLabel} | ${d.status}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="physician-productivity-report.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProductivitySummary,
  getProductivityDoctors,
  getProductivityDoctorById,
  updateProductivityDoctorStatus,
  exportProductivityCsv,
  exportProductivityPdf,
};
