const Schedule = require('../models/Schedule');
const Doctor = require('../models/Doctor');

// GET /api/doctors/schedules?week=47&year=2026
const getDoctorSchedulesRoster = async (req, res) => {
  try {
    const { week, year } = req.query;
    const filter = {};
    if (week) filter.week = Number(week);
    if (year) filter.year = Number(year);

    const schedules = await Schedule.find(filter).sort({ doctorId: 1, day: 1 }).lean();

    const grouped = new Map();
    for (const s of schedules) {
      if (!grouped.has(s.doctorId)) {
        grouped.set(s.doctorId, {
          doctorId: s.doctorId,
          fullName: s.fullName,
          specialty: s.specialty,
          week: s.week,
          year: s.year,
          schedules: [],
        });
      }
      grouped.get(s.doctorId).schedules.push({
        _id: s._id,
        day: s.day,
        shift: s.shift,
        type: s.type,
        status: s.status,
      });
    }

    return res.status(200).json({
      success: true,
      count: grouped.size,
      data: Array.from(grouped.values()),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch duty roster.', error: error.message });
  }
};

// GET /api/schedules?doctorId=DOC-101 or GET /api/schedules/:doctorId
const getSchedulesByDoctor = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.query.doctorId;
    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    if (req.query.week) filter.week = Number(req.query.week);
    if (req.query.year) filter.year = Number(req.query.year);

    const schedules = await Schedule.find(filter).sort({ week: -1, day: 1 }).lean();
    return res.status(200).json({ success: true, count: schedules.length, data: schedules });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/schedules
const createSchedule = async (req, res) => {
  try {
    const { doctorId, day, shift, type, status, week, year, fullName, specialty } = req.body;
    const doctor = await Doctor.findOne({ doctorId });
    if (!doctor && (!fullName || !specialty)) {
      return res.status(404).json({ success: false, message: 'Doctor not found for the given doctorId.' });
    }

    const schedule = await Schedule.create({
      doctor: doctor?._id,
      doctorId,
      fullName: doctor?.name || fullName,
      specialty: doctor?.specialization || specialty,
      day: String(day).toUpperCase(),
      shift,
      type: type || 'Clinic',
      status: status || 'On Duty',
      week: Number(week),
      year: Number(year),
    });

    return res.status(201).json({ success: true, message: 'Duty schedule created.', data: schedule });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/schedules/:id
const updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    return res.status(200).json({ success: true, message: 'Schedule updated.', data: schedule });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/schedules/:id
const deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    return res.status(200).json({ success: true, message: 'Schedule deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDoctorSchedulesRoster,
  getSchedulesByDoctor,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
