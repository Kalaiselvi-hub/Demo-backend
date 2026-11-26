const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// GET /api/staff?search=&department=&status=
const getStaff = async (req, res) => {
  try {
    const { search = '', department = '', status = '' } = req.query;
    const filter = { isActive: true };

    if (department && department !== 'All') filter.department = new RegExp(department.trim(), 'i');
    if (status && status !== 'All') filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { staffId: regex },
        { fullName: regex },
        { role: regex },
        { department: regex },
      ];
    }

    const staffList = await Staff.find(filter).sort({ staffId: 1 }).lean();
    return res.status(200).json({
      success: true,
      totalStaff: staffList.length,
      data: staffList,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch staff directory.', error: error.message });
  }
};

// GET /api/staff/by-role
const getStaffByRole = async (req, res) => {
  try {
    const [totalStaff, agg] = await Promise.all([
      Staff.countDocuments({ isActive: true }),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const data = agg.map((item) => ({
      roleGroup: item._id,
      count: item.count,
      percentage: totalStaff === 0 ? 0 : Number(((item.count / totalStaff) * 100).toFixed(2)),
    }));

    return res.status(200).json({ success: true, totalStaff, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/staff/attendance/weekly
const getWeeklyAttendance = async (req, res) => {
  try {
    const agg = await Attendance.aggregate([
      {
        $group: {
          _id: { day: { $dayOfWeek: '$date' }, status: '$status' },
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

// GET /api/staff/:id
const getStaffById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { staffId: req.params.id.toUpperCase() };

    const staff = await Staff.findOne(filter).lean();
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    return res.status(200).json({ success: true, data: staff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const STAFF_ROLES = [
  'Staff Nurse',
  'Head Nurse & Matron',
  'Chief Pharmacist',
  'Chief Medical Lab Scientist',
  'Senior Radiology Technologist',
  'Staff Nurse (ICU Specialist)',
  'Hospital Billing Manager',
  'Lead Receptionist & Patient Relations',
  'Chief Biomedical Engineer',
];

const STAFF_DEPARTMENTS = [
  'Nursing Services',
  'Pharmacy',
  'Pathology & Lab',
  'Radiology',
  'Intensive Care Unit',
  'Finance & Accounts',
  'Front Desk',
  'Facilities & Maint',
];

const STAFF_SHIFTS = [
  'Morning (07:00 - 15:00)',
  'Morning (08:00 - 16:00)',
  'Day Shift (08:00 - 17:00)',
  'Evening (14:00 - 22:00)',
  'Night Shift (22:00 - 07:00)',
  'On Call (24/7)',
];

// GET /api/staff/next-id
const getNextStaffId = async (req, res) => {
  try {
    const count = await Staff.countDocuments();
    const nextId = `STF-${String(count + 1).padStart(2, '0')}`;
    return res.status(200).json({ success: true, nextId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/staff/departments
const getStaffDepartments = (req, res) => {
  return res.status(200).json({ success: true, departments: STAFF_DEPARTMENTS });
};

// GET /api/staff/roles
const getStaffRoles = (req, res) => {
  return res.status(200).json({ success: true, roles: STAFF_ROLES });
};

// GET /api/staff/shifts
const getStaffShifts = (req, res) => {
  return res.status(200).json({ success: true, shifts: STAFF_SHIFTS });
};

// POST /api/staff
const createStaff = async (req, res) => {
  try {
    const { fullName, role, department, assignedShift, contactPhone } = req.body;
    if (!fullName || !role || !department || !assignedShift || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Role, Department, Work Shift, and Contact Phone are required.',
      });
    }

    const existingPhone = await Staff.findOne({ contactPhone: contactPhone.trim() });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'A staff member with this phone number already exists.',
      });
    }

    const staff = await Staff.create(req.body);
    return res.status(201).json({ success: true, message: 'Staff registered successfully', data: staff });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    return res.status(200).json({ success: true, message: 'Staff member updated.', data: staff });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/staff/:id
const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    return res.status(200).json({ success: true, message: 'Staff member deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStaff,
  getStaffByRole,
  getWeeklyAttendance,
  getNextStaffId,
  getStaffDepartments,
  getStaffRoles,
  getStaffShifts,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
};
