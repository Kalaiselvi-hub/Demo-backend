const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const computePatientsByDepartment = async () => {
  const [totalPatients, agg] = await Promise.all([
    Patient.countDocuments(),
    Patient.aggregate([
      { $group: { _id: { $ifNull: ['$department', 'General Medicine'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const byDepartment = agg.map((item) => ({
    department: item._id,
    count: item.count,
    percentage: totalPatients === 0 ? 0 : Number(((item.count / totalPatients) * 100).toFixed(2)),
  }));

  return { totalPatients, byDepartment };
};

const computeNewPatientsPerMonth = async (year) => {
  const targetYear = Number(year) || new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  const agg = await Patient.aggregate([
    { $match: { createdAt: { $gte: startOfYear, $lte: endOfYear } } },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
  ]);

  const monthMap = new Map(agg.map((m) => [m._id, m.count]));
  const data = MONTH_NAMES.map((month, idx) => ({
    month,
    newPatients: monthMap.get(idx + 1) || 0,
  }));

  return { year: targetYear, data };
};

const fetchPaginatedPatients = async ({ page = 1, limit = 10, search = '', status = '', department = '', viewAll = false }) => {
  const query = {};

  if (status && status !== 'All') {
    query.status = status;
  }
  if (department && department !== 'All') {
    query.department = department;
  }
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ patientId: regex }, { name: regex }, { phone: regex }];
  }

  const total = await Patient.countDocuments(query);
  let dbQuery = Patient.find(query)
    .populate('assignedDoctor', 'name specialization department')
    .sort({ createdAt: -1 });

  if (!viewAll) {
    const skip = (Number(page) - 1) * Number(limit);
    dbQuery = dbQuery.skip(skip).limit(Number(limit));
  }

  const patients = await dbQuery.lean();
  return {
    total,
    page: viewAll ? 1 : Number(page),
    limit: viewAll ? total : Number(limit),
    patients,
  };
};

// GET /api/patients
const getPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', department = '', viewAll = 'false' } = req.query;
    const data = await fetchPaginatedPatients({
      page,
      limit,
      search,
      status,
      department,
      viewAll: viewAll === 'true',
    });
    return res.status(200).json({ success: true, count: data.patients.length, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch patients.', error: error.message });
  }
};

// GET /api/patients/:id
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('assignedDoctor', 'name specialization department');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    return res.status(200).json({ success: true, patient });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch patient.', error: error.message });
  }
};

// POST /api/patients
const createPatient = async (req, res) => {
  try {
    const {
      fullName,
      name,
      age,
      sex,
      gender,
      phone,
      bloodGroup,
      assignedDoctor,
      assignedPhysician,
      department,
      status,
      address,
      residentialAddress,
      emergencyContact,
      diagnosis,
      email,
      dateOfBirth,
    } = req.body;

    const patientName = (fullName || name || '').trim();
    if (patientName.length < 3 || !/^[A-Za-z\s.'-]+$/.test(patientName)) {
      return res.status(400).json({
        success: false,
        message: 'Patient Full Name must be at least 3 characters and contain only letters.',
      });
    }

    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    if (!/^\+234\d{10}$/.test(normalizedPhone) && !/^\+\d{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must start with +234 followed by 10 digits (e.g. +2348031234567).',
      });
    }

    const numericAge = Number(age);
    if (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120) {
      return res.status(400).json({ success: false, message: 'Age must be a number between 0 and 120.' });
    }

    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ success: false, message: 'Invalid blood group.' });
    }

    const patientStatus = status || 'Outpatient';
    if (patientStatus === 'Inpatient' && !emergencyContact) {
      return res.status(400).json({
        success: false,
        message: 'Emergency Contact is required for Inpatient admissions.',
      });
    }

    const doctorId = assignedPhysician || assignedDoctor;
    if (doctorId) {
      const doctorExists = await Doctor.findById(doctorId);
      if (!doctorExists) {
        return res.status(400).json({ success: false, message: 'Assigned Physician not found in database.' });
      }
    }

    const existingPhone = await Patient.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'A patient with this phone number already exists.' });
    }

    const patient = await Patient.create({
      name: patientName,
      age: numericAge,
      gender: sex || gender,
      phone: normalizedPhone,
      bloodGroup: bloodGroup || 'Unknown',
      assignedDoctor: doctorId,
      department: department || 'General Medicine',
      status: patientStatus,
      address: residentialAddress || address || '',
      emergencyContact: emergencyContact || '',
      diagnosis: diagnosis || '',
      email,
      dateOfBirth,
      createdBy: req.admin._id,
    });

    const populated = await Patient.findById(patient._id).populate('assignedDoctor', 'name specialization department');
    return res.status(201).json({ success: true, message: 'Patient registered successfully', patient: populated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/patients/:id
const updatePatient = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.fullName) updates.name = updates.fullName;
    if (updates.sex) updates.gender = updates.sex;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('assignedDoctor', 'name specialization department');

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    return res.status(200).json({ success: true, message: 'Patient updated successfully.', patient });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    return res.status(200).json({ success: true, message: 'Patient deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete patient.', error: error.message });
  }
};

// PATCH /api/patients/:id/status
const updatePatientStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Inpatient', 'Outpatient', 'Emergency', 'Discharged'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid patient status.' });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).populate('assignedDoctor', 'name specialization department');

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    return res.status(200).json({ success: true, message: 'Patient status updated.', patient });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update status.', error: error.message });
  }
};

// GET /api/patients/by-department
const getPatientsByDepartment = async (req, res) => {
  try {
    const data = await computePatientsByDepartment();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/patients/new-per-month
const getNewPatientsPerMonth = async (req, res) => {
  try {
    const data = await computeNewPatientsPerMonth(req.query.year);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/patients/overview
const getPatientsOverview = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', department = '', year } = req.query;
    const [paginated, byDepartment, newPerMonth] = await Promise.all([
      fetchPaginatedPatients({ page, limit, search, status, department }),
      computePatientsByDepartment(),
      computeNewPatientsPerMonth(year),
    ]);

    return res.status(200).json({
      success: true,
      overview: {
        totalPatients: byDepartment.totalPatients,
        patientsList: paginated,
        byDepartment: byDepartment.byDepartment,
        newPerMonth,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/patients/blood-groups
const getBloodGroups = (req, res) => {
  return res.status(200).json({ success: true, bloodGroups: BLOOD_GROUPS });
};

// GET /api/patients/genders
const getGenders = (req, res) => {
  return res.status(200).json({ success: true, genders: GENDERS });
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  updatePatientStatus,
  getPatientsByDepartment,
  getNewPatientsPerMonth,
  getPatientsOverview,
  getBloodGroups,
  getGenders,
};
