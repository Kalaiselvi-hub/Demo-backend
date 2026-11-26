const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Specialization = require('../models/Specialization');
const Department = require('../models/Department');

const computeDoctorsByDepartment = async () => {
  const [totalDoctors, agg] = await Promise.all([
    Doctor.countDocuments(),
    Doctor.aggregate([
      { $group: { _id: { $ifNull: ['$department', 'General Medicine'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const byDepartment = agg.map((item) => ({
    department: item._id,
    count: item.count,
    percentage: totalDoctors === 0 ? 0 : Number(((item.count / totalDoctors) * 100).toFixed(2)),
  }));

  return { totalDoctors, byDepartment };
};

const fetchPaginatedDoctors = async ({ page = 1, limit = 10, search = '', department = '', status = '', sortBy = 'name' }) => {
  const query = {};
  if (department && department !== 'All' && department !== 'All Departments') {
    query.department = new RegExp(department.trim(), 'i');
  }
  if (status && status !== 'All') {
    query.status = status;
  }
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: regex }, { specialization: regex }, { doctorId: regex }];
  }

  const sortObj = sortBy === 'department' ? { department: 1, name: 1 } : { name: 1 };
  const total = await Doctor.countDocuments(query);
  const skip = (Number(page) - 1) * Number(limit);

  const doctors = await Doctor.find(query).sort(sortObj).skip(skip).limit(Number(limit)).lean();
  const formatted = doctors.map((d) => ({
    ...d,
    displayName: `${d.name} (${d.specialization})`,
  }));

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    doctors: formatted,
  };
};

// GET /api/doctors
const getDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', department = '', status = '', sortBy = 'name' } = req.query;
    const data = await fetchPaginatedDoctors({ page, limit, search, department, status, sortBy });
    return res.status(200).json({ success: true, count: data.doctors.length, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch doctors.', error: error.message });
  }
};

// GET /api/doctors/specializations
const getSpecializations = async (req, res) => {
  try {
    const { department = '' } = req.query;
    const filter = { isActive: true };
    if (department && department !== 'All') {
      filter.department = new RegExp(department.trim(), 'i');
    }
    const specializations = await Specialization.find(filter).sort({ title: 1 }).lean();
    return res.status(200).json({ success: true, count: specializations.length, specializations });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch specializations.', error: error.message });
  }
};

// GET /api/doctors/check?email=...&phone=...
const checkDoctorDuplicate = async (req, res) => {
  try {
    const { email = '', phone = '' } = req.query;
    const result = { emailExists: false, phoneExists: false };

    if (email.trim()) {
      result.emailExists = !!(await Doctor.findOne({ email: email.trim().toLowerCase() }));
    }
    if (phone.trim()) {
      result.phoneExists = !!(await Doctor.findOne({ phone: phone.trim() }));
    }

    const isDuplicate = result.emailExists || result.phoneExists;
    return res.status(200).json({
      success: true,
      isDuplicate,
      ...result,
      message: isDuplicate
        ? result.emailExists && result.phoneExists
          ? 'Both email and phone already exist.'
          : result.emailExists
          ? 'A doctor with this email already exists.'
          : 'A doctor with this phone number already exists.'
        : 'No duplicates found.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDoctorsByDepartment = async (req, res) => {
  try {
    const data = await computeDoctorsByDepartment();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/doctors/overview
const getDoctorsOverview = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', department = '', status = '' } = req.query;
    const [doctorsList, byDepartment, onDutyCount] = await Promise.all([
      fetchPaginatedDoctors({ page, limit, search, department, status }),
      computeDoctorsByDepartment(),
      Doctor.countDocuments({ status: { $in: ['On Duty', 'Active'] } }),
    ]);

    return res.status(200).json({
      success: true,
      overview: {
        totalDoctors: byDepartment.totalDoctors,
        onDutyCount,
        doctorsList,
        byDepartment: byDepartment.byDepartment,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/doctors/:id & /:id/profile
const getDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).lean();
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }
    return res.status(200).json({ success: true, doctor });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/doctors/:id/patients
const getDoctorPatients = async (req, res) => {
  try {
    const patients = await Patient.find({ assignedDoctor: req.params.id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, count: patients.length, patients });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/doctors/:id/appointments
const getDoctorAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctor: req.params.id })
      .populate('patient', 'patientId name age phone')
      .sort({ appointmentDate: 1 })
      .lean();
    return res.status(200).json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/doctors/:id/schedule
const getDoctorSchedule = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('name availability schedule status').lean();
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, ...doctor });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/doctors
const createDoctor = async (req, res) => {
  try {
    const {
      fullName, name, email, phone,
      department, specialization, qualifications, qualification,
      experienceYears, consultationFee, status, availability,
      profilePhoto, rating, schedule,
    } = req.body;

    const doctorName = (fullName || name || '').trim();
    if (!doctorName || doctorName.length < 2) {
      return res.status(400).json({ success: false, message: 'Doctor Full Name is required (minimum 2 characters).' });
    }

    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.replace(/\s+/g, ''))) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    if (!department) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }
    if (!specialization) {
      return res.status(400).json({ success: false, message: 'Specialization is required.' });
    }

    const fee = Number(consultationFee);
    if (Number.isNaN(fee) || fee < 0) {
      return res.status(400).json({ success: false, message: 'Consultation Fee must be a valid number (₦).' });
    }

    const expYears = Number(experienceYears);
    if (Number.isNaN(expYears) || expYears < 0) {
      return res.status(400).json({ success: false, message: 'Years of Experience must be 0 or greater.' });
    }

    const existingEmail = await Doctor.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'A doctor with this email already exists.' });
    }
    const existingPhone = await Doctor.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'A doctor with this phone number already exists.' });
    }

    const doctor = await Doctor.create({
      name: doctorName,
      email: normalizedEmail,
      phone: normalizedPhone,
      department,
      specialization,
      qualification: qualifications || qualification || 'MBBS',
      qualifications: qualifications || qualification || 'MBBS',
      experienceYears: expYears,
      consultationFee: fee,
      status: status || 'On Duty',
      availability: availability || 'Mon-Fri 9AM-5PM',
      profilePhoto: profilePhoto || '',
      rating: rating || 4.8,
      schedule: schedule || [],
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor profile created successfully',
      data: {
        doctorId: doctor.doctorId,
        fullName: doctor.name,
        department: doctor.department,
        specialization: doctor.specialization,
        status: doctor.status,
      },
      doctor,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.fullName) updates.name = updates.fullName;
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, message: 'Doctor updated successfully.', doctor });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/doctors/:id/status
const updateDoctorStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['On Duty', 'Off Duty', 'On Leave', 'Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor status.' });
    }
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, message: 'Doctor status updated.', doctor });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    return res.status(200).json({ success: true, message: 'Doctor deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDoctors,
  getDoctorsByDepartment,
  getDoctorsOverview,
  getSpecializations,
  checkDoctorDuplicate,
  getDoctorProfile,
  getDoctorPatients,
  getDoctorAppointments,
  getDoctorSchedule,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  deleteDoctor,
};
