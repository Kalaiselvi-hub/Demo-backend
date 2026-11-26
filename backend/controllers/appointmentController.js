const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const computeAppointmentStats = async () => {
  const agg = await Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const map = new Map(agg.map((a) => [a._id, a.count]));
  const total = agg.reduce((sum, a) => sum + a.count, 0);

  return {
    total,
    pending: map.get('Pending') || 0,
    completed: map.get('Completed') || 0,
    cancelledNoShow: (map.get('Cancelled') || 0) + (map.get('No-Show') || 0),
    confirmed: map.get('Confirmed') || 0,
    inProgress: (map.get('In Progress') || 0) + (map.get('In Consultation') || 0),
  };
};

// GET /api/appointments?status=&department=&date=&search=
const getAppointments = async (req, res) => {
  try {
    const { status = '', department = '', priority = '', date = '', search = '', page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'All') query.status = status;
    if (department && department !== 'All') query.department = new RegExp(department.trim(), 'i');
    if (priority && priority !== 'All') query.priority = priority;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: start, $lte: end };
    }
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      const [pts, docs] = await Promise.all([
        Patient.find({ $or: [{ name: regex }, { phone: regex }] }).select('_id'),
        Doctor.find({ name: regex }).select('_id'),
      ]);
      query.$or = [
        { appointmentId: regex },
        { patientFullName: regex },
        { contactPhoneNumber: regex },
        { consultingPhysician: regex },
        { patient: { $in: pts.map((p) => p._id) } },
        { doctor: { $in: docs.map((d) => d._id) } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [stats, appointments] = await Promise.all([
      computeAppointmentStats(),
      Appointment.find(query)
        .populate('patient', 'patientId name gender phone age')
        .populate('doctor', 'doctorId name specialization department')
        .sort({ appointmentDate: -1, timeSlot: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      filters: { status: status || 'All', search, department, priority, date },
      count: appointments.length,
      stats,
      data: appointments,
      appointments,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch appointments.', error: error.message });
  }
};

// GET /api/appointments/stats
const getAppointmentStats = async (req, res) => {
  try {
    const stats = await computeAppointmentStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/appointments/status-breakdown
const getStatusBreakdown = async (req, res) => {
  try {
    const agg = await Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const total = agg.reduce((sum, a) => sum + a.count, 0);
    const breakdown = agg.map((item) => ({
      status: item._id,
      count: item.count,
      percentage: total === 0 ? 0 : Number(((item.count / total) * 100).toFixed(2)),
    }));
    return res.status(200).json({ success: true, total, breakdown });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/appointments/per-day
const getAppointmentsPerDay = async (req, res) => {
  try {
    const agg = await Appointment.aggregate([
      { $group: { _id: { $dayOfWeek: '$appointmentDate' }, count: { $sum: 1 } } },
    ]);
    const dayMap = new Map();
    for (const item of agg) {
      const idx = item._id === 1 ? 6 : item._id - 2;
      dayMap.set(idx, item.count);
    }
    const data = DAY_NAMES.map((day, idx) => ({ day, appointments: dayMap.get(idx) || 0 }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/appointments/:id
const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'patientId name phone age gender')
      .populate('doctor', 'doctorId name specialization department');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    return res.status(200).json({ success: true, appointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch appointment.', error: error.message });
  }
};

// POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { patient, patientId, doctor, doctorId, date, appointmentDate, ...rest } = req.body;

    let patRef = patient;
    if (!patRef && patientId) {
      const p = await Patient.findOne({ patientId });
      if (!p) return res.status(404).json({ success: false, message: 'Patient not found.' });
      patRef = p._id;
    }

    let docRef = doctor;
    if (!docRef && doctorId) {
      const d = await Doctor.findOne({ doctorId });
      if (!d) return res.status(404).json({ success: false, message: 'Doctor not found.' });
      docRef = d._id;
    }

    const appointment = await Appointment.create({
      ...rest,
      patient: patRef,
      doctor: docRef,
      appointmentDate: appointmentDate || date || new Date(),
      createdBy: req.admin._id,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('patient', 'patientId name gender phone')
      .populate('doctor', 'doctorId name specialization department');

    return res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully.',
      appointment: populated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/appointments/:id
const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('patient', 'patientId name gender phone')
      .populate('doctor', 'doctorId name specialization department');

    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    return res.status(200).json({ success: true, message: 'Appointment updated.', appointment });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/appointments/:id/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Confirmed', 'Pending', 'In Progress', 'In Consultation', 'Completed', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment status.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { appointmentId: req.params.id };

    const appointment = await Appointment.findOneAndUpdate(
      filter,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate('patient', 'patientId name phone age')
      .populate('doctor', 'doctorId name specialization department');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Appointment status updated.',
      data: appointment,
      appointment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update status.', error: error.message });
  }
};

// DELETE /api/appointments/:id
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    return res.status(200).json({ success: true, message: 'Appointment deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const STANDARD_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM',
];

// GET /api/appointments/available-slots?doctorId=DOC-101&date=2026-11-18
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ success: false, message: 'doctorId and date are required.' });
    }

    const doctor = await Doctor.findOne({
      $or: [{ doctorId }, { _id: doctorId.match(/^[0-9a-fA-F]{24}$/) ? doctorId : null }],
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const booked = await Appointment.find({
      doctor: doctor._id,
      appointmentDate: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' },
    }).select('timeSlot');

    const bookedSet = new Set(booked.map((b) => b.timeSlot));
    const availableSlots = STANDARD_SLOTS.filter((slot) => !bookedSet.has(slot));

    return res.status(200).json({
      success: true,
      doctorId: doctor.doctorId || doctor._id,
      date,
      availableSlots,
      bookedSlots: Array.from(bookedSet),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/appointments/book
const bookAppointment = async (req, res) => {
  try {
    const {
      patientFullName,
      contactPhoneNumber,
      patientAge,
      specialtyDepartment,
      consultingPhysician,
      doctorId,
      appointmentDate,
      timeSlot,
      symptoms,
    } = req.body;

    if (!patientFullName || !contactPhoneNumber || !specialtyDepartment || !appointmentDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Patient Full Name, Phone, Department, Date, and Time Slot are required.',
      });
    }

    const digits = String(contactPhoneNumber).replace(/\D/g, '');
    if (digits.length < 10) {
      return res.status(400).json({ success: false, message: 'Contact Phone Number must have at least 10 digits.' });
    }

    if (patientAge !== undefined && (Number(patientAge) < 0 || Number(patientAge) > 120)) {
      return res.status(400).json({ success: false, message: 'Patient Age must be between 0 and 120.' });
    }

    const aptDate = new Date(appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (aptDate < today) {
      return res.status(400).json({ success: false, message: 'Appointment Date cannot be in the past.' });
    }

    const doctor = await Doctor.findOne({
      $or: [
        { doctorId: doctorId || '' },
        { name: consultingPhysician || '' },
        { _id: doctorId && doctorId.match(/^[0-9a-fA-F]{24}$/) ? doctorId : null },
      ],
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Consulting Physician not found.' });
    }

    const start = new Date(aptDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(aptDate);
    end.setHours(23, 59, 59, 999);

    const existingSlot = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate: { $gte: start, $lte: end },
      timeSlot,
      status: { $ne: 'Cancelled' },
    });
    if (existingSlot) {
      return res.status(409).json({
        success: false,
        message: 'This slot is already booked for the selected doctor and date.',
      });
    }

    const appointment = await Appointment.create({
      patientFullName,
      contactPhoneNumber,
      patientAge,
      department: specialtyDepartment,
      consultingPhysician: doctor.name,
      doctor: doctor._id,
      appointmentDate: aptDate,
      timeSlot,
      symptoms: symptoms || '',
      reason: symptoms || 'Clinic Consultation',
      visitType: 'Consultation',
      status: 'Pending',
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        _id: appointment._id,
        aptId: appointment.appointmentId,
        patientFullName: appointment.patientFullName,
        assignedDoctor: doctor.name,
        department: appointment.department,
        visitType: appointment.visitType,
        status: appointment.status,
        date: appointmentDate,
        timeSlot: appointment.timeSlot,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/appointments/calendar?month=2026-11
const getAppointmentCalendar = async (req, res) => {
  try {
    const monthParam = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthStr] = monthParam.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const appointments = await Appointment.find({
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .populate('patient', 'patientId name gender')
      .populate('doctor', 'doctorId name specialization department')
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .lean();

    const dateMap = new Map();
    for (const apt of appointments) {
      const d = new Date(apt.appointmentDate);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey).push({
        _id: apt._id,
        aptId: apt.appointmentId,
        timeSlot: apt.timeSlot,
        patientName: apt.patientFullName || apt.patient?.name || 'Patient',
        assignedDoctor: apt.consultingPhysician || apt.doctor?.name || 'Doctor',
        department: apt.department,
        status: apt.status,
      });
    }

    const data = Array.from(dateMap.entries()).map(([date, list]) => ({
      date,
      count: list.length,
      appointments: list,
    }));

    return res.status(200).json({ success: true, month: monthParam, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/appointments/per-week?month=2026-11
const getAppointmentsPerWeek = async (req, res) => {
  try {
    const monthParam = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthStr] = monthParam.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const appointments = await Appointment.find({
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .select('appointmentDate')
      .lean();

    const weekCounts = [0, 0, 0, 0];
    for (const apt of appointments) {
      const dayOfMonth = new Date(apt.appointmentDate).getDate();
      const weekIdx = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
      weekCounts[weekIdx]++;
    }

    const data = weekCounts.map((count, idx) => ({
      week: `Week ${idx + 1}`,
      count,
    }));

    return res.status(200).json({ success: true, month: monthParam, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAppointments,
  getAppointmentStats,
  getStatusBreakdown,
  getAppointmentsPerDay,
  getAppointmentCalendar,
  getAppointmentsPerWeek,
  getAvailableSlots,
  bookAppointment,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
};
