const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

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

const parseTimeMinutes = (timeStr = '') => {
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 10 * 60;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const p = match[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

const SLOT_DEFS = [
  { slot: '08:00 AM - 10:00 AM', startTime: '08:00', endTime: '10:00', min: 8 * 60, max: 10 * 60, label: 'Early Morning Slot' },
  { slot: '10:00 AM - 01:00 PM', startTime: '10:00', endTime: '13:00', min: 10 * 60, max: 13 * 60, label: 'High Clinical Density' },
  { slot: '02:00 PM - 04:00 PM', startTime: '14:00', endTime: '16:00', min: 14 * 60, max: 16 * 60, label: 'Afternoon Consultations' },
  { slot: '04:00 PM - 07:00 PM', startTime: '16:00', endTime: '19:00', min: 16 * 60, max: 19 * 60, label: 'Evening Reviews' },
];

const computePeakHours = async (period = 'this-month') => {
  const { start, end } = getPeriodBounds(period);
  const appointments = await Appointment.find({ appointmentDate: { $gte: start, $lte: end } })
    .select('timeSlot')
    .lean();

  const counts = [0, 0, 0, 0];
  for (const apt of appointments) {
    const mins = parseTimeMinutes(apt.timeSlot);
    let idx = SLOT_DEFS.findIndex((s) => mins >= s.min && mins < s.max);
    if (idx === -1) idx = 1;
    counts[idx]++;
  }

  const maxCount = Math.max(...counts);
  return SLOT_DEFS.map((s, idx) => ({
    slot: s.slot,
    startTime: s.startTime,
    endTime: s.endTime,
    patientCount: counts[idx],
    label: s.label,
    isPeak: maxCount > 0 && counts[idx] === maxCount,
  }));
};

// GET /api/reports/appointment-load/stats/summary
const getAppointmentLoadSummary = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const { start, end, label } = getPeriodBounds(period);

    const agg = await Appointment.aggregate([
      { $match: { appointmentDate: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const map = new Map(agg.map((a) => [a._id, a.count]));
    const totalScheduled = agg.reduce((sum, a) => sum + a.count, 0);
    const completedCount = map.get('Completed') || 0;
    const pendingCount = map.get('Pending') || 0;
    const cancelledCount = map.get('Cancelled') || 0;
    const noShowCount = map.get('No-Show') || 0;

    const pct = (n) => (totalScheduled === 0 ? 0 : Number(((n / totalScheduled) * 100).toFixed(1)));

    return res.status(200).json({
      success: true,
      data: {
        totalScheduled,
        totalScheduledLabel: `${label} Volume`,
        completionRate: pct(completedCount),
        completedCount,
        pendingConfirmationRate: pct(pendingCount),
        pendingCount,
        cancellationRate: pct(cancelledCount),
        cancelledCount,
        noShowRate: pct(noShowCount),
        noShowCount,
        reportingPeriod: label,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/appointment-load/peak-hours
const getPeakHours = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const data = await computePeakHours(period);
    return res.status(200).json({ success: true, total: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/appointment-load/appointments
const getLoadAppointments = async (req, res) => {
  try {
    const { status = '', search = '', page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      const pts = await Patient.find({ name: regex }).select('_id');
      filter.$or = [
        { appointmentId: regex },
        { patientFullName: regex },
        { patient: { $in: pts.map((p) => p._id) } },
      ];
    }

    const total = await Appointment.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);
    const appointments = await Appointment.find(filter)
      .populate('patient', 'name')
      .populate('doctor', 'name')
      .sort({ appointmentDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const data = appointments.map((a) => ({
      _id: a._id,
      appointmentId: a.appointmentId,
      patientName: a.patientFullName || a.patient?.name || 'Patient',
      doctorName: a.consultingPhysician || a.doctor?.name || 'Doctor',
      specialty: a.department,
      appointmentDate: a.appointmentDate,
      appointmentTime: a.timeSlot,
      status: a.status,
    }));

    return res.status(200).json({ success: true, total, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/appointment-load/export/csv
const exportAppointmentLoadCsv = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const data = await computePeakHours(period);
    const headers = ['Time Slot', 'Patient Count', 'Label', 'Is Peak'];
    const rows = data.map((d) =>
      [d.slot, d.patientCount, d.label, d.isPeak ? 'YES' : 'NO']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="appointment-load-report.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reports/appointment-load/export/pdf
const exportAppointmentLoadPdf = async (req, res) => {
  try {
    const period = req.query.period || 'this-month';
    const data = await computePeakHours(period);
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - APPOINTMENT LOAD ANALYTICS',
      `Period: ${period}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      ...data.map((d) => `${d.slot} | Patients: ${d.patientCount} | ${d.label}${d.isPeak ? ' (PEAK)' : ''}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="appointment-load-report.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAppointmentLoadSummary,
  getPeakHours,
  getLoadAppointments,
  exportAppointmentLoadCsv,
  exportAppointmentLoadPdf,
};
