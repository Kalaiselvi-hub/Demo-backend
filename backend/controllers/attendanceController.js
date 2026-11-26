const Attendance = require('../models/Attendance');
const Staff = require('../models/Staff');

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTime12h = (date = new Date()) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const mins = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
};

// GET /api/attendance?date=&staffId=&status=
const getAttendance = async (req, res) => {
  try {
    const { date = '', staffId = '', status = '' } = req.query;
    const filter = { isActive: true };
    if (date) filter.dateString = date;
    if (staffId) filter.staffId = staffId.toUpperCase();
    if (status && status !== 'All') filter.attendanceStatus = status;

    const records = await Attendance.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    return res.status(200).json({ success: true, total: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/today
const getTodayAttendance = async (req, res) => {
  try {
    const today = getTodayString();
    const records = await Attendance.find({ dateString: today, isActive: true }).sort({ createdAt: 1 }).lean();
    return res.status(200).json({ success: true, date: today, total: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/weekly
const getWeeklyAttendance = async (req, res) => {
  try {
    const agg = await Attendance.aggregate([
      {
        $group: {
          _id: { day: { $dayOfWeek: '$date' }, status: '$attendanceStatus' },
          count: { $sum: 1 },
        },
      },
    ]);

    const presentMap = new Map();
    const absentMap = new Map();
    for (const item of agg) {
      const idx = item._id.day === 1 ? 6 : item._id.day - 2;
      if (item._id.status === 'Present') presentMap.set(idx, item.count);
      else absentMap.set(idx, (absentMap.get(idx) || 0) + item.count);
    }

    const data = DAY_NAMES.map((day, idx) => ({
      day,
      present: presentMap.get(idx) || 0,
      absent: absentMap.get(idx) || 0,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/:id
const getAttendanceById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { attendanceId: req.params.id.toUpperCase() };

    const record = await Attendance.findOne(filter).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance/check-in
const checkIn = async (req, res) => {
  try {
    const { staffId, staffName, role, checkIn: customCheckIn } = req.body;
    if (!staffId) return res.status(400).json({ success: false, message: 'staffId is required.' });

    const today = getTodayString();
    const existing = await Attendance.findOne({ staffId: staffId.toUpperCase(), dateString: today });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Staff member already checked in today.',
        data: existing,
      });
    }

    const staffDoc = await Staff.findOne({ staffId: staffId.toUpperCase() });
    const checkInTime = customCheckIn || formatTime12h(new Date());
    const mins = parseTimeToMinutes(checkInTime);
    const attendanceStatus = mins !== null && mins > 8 * 60 ? 'Late' : 'Present';

    const record = await Attendance.create({
      staff: staffDoc?._id,
      staffId: staffId.toUpperCase(),
      staffName: staffDoc?.fullName || staffName || 'Staff Member',
      role: staffDoc?.role || role || 'Staff',
      date: new Date(),
      dateString: today,
      checkIn: checkInTime,
      checkOut: null,
      attendanceStatus,
      status: attendanceStatus,
      workHours: 'In Progress',
    });

    return res.status(201).json({ success: true, message: 'Checked in successfully.', data: record });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/attendance/check-out/:id
const checkOut = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { attendanceId: req.params.id.toUpperCase() };

    const record = await Attendance.findOne(filter);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });

    const checkOutTime = req.body?.checkOut || formatTime12h(new Date());
    record.checkOut = checkOutTime;

    const inMins = parseTimeToMinutes(record.checkIn);
    const outMins = parseTimeToMinutes(checkOutTime);
    if (inMins !== null && outMins !== null) {
      let diff = outMins - inMins;
      if (diff < 0) diff += 24 * 60;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      record.workHours = `${hrs}h ${String(mins).padStart(2, '0')}m`;
    }

    await record.save();
    return res.status(200).json({ success: true, message: 'Checked out successfully.', data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/attendance/:id
const deleteAttendance = async (req, res) => {
  try {
    const deleted = await Attendance.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return res.status(200).json({ success: true, message: 'Attendance record deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAttendance,
  getTodayAttendance,
  getWeeklyAttendance,
  getAttendanceById,
  checkIn,
  checkOut,
  deleteAttendance,
};
