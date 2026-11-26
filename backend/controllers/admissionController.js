const Admission = require('../models/Admission');
const Bed = require('../models/Bed');
const Patient = require('../models/Patient');

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getWeekBounds = (weekParam = 'current') => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + (weekParam === 'previous' ? -7 : 0));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
};

const computeDailyAdmissions = async (weekParam = 'current') => {
  const { monday, sunday } = getWeekBounds(weekParam);

  const agg = await Admission.aggregate([
    { $match: { admissionDate: { $gte: monday, $lte: sunday } } },
    {
      $group: {
        _id: { $dayOfWeek: '$admissionDate' }, // 1=Sun, 2=Mon, ..., 7=Sat
        count: { $sum: 1 },
      },
    },
  ]);

  // Map MongoDB $dayOfWeek (2=Mon..7=Sat, 1=Sun) to index 0..6 (Mon..Sun)
  const dayMap = new Map();
  for (const item of agg) {
    const idx = item._id === 1 ? 6 : item._id - 2;
    dayMap.set(idx, item.count);
  }

  let totalAdmissions = 0;
  const data = DAY_NAMES.map((day, idx) => {
    const admissions = dayMap.get(idx) || 0;
    totalAdmissions += admissions;
    return { day, admissions };
  });

  return {
    week: weekParam === 'previous' ? 'Previous Week' : 'Current Week',
    totalAdmissions,
    data,
  };
};

const fetchDischargedPatients = async ({ page = 1, limit = 10, search = '', outcome = '', from = '', to = '' }) => {
  const query = { status: 'Discharged' };

  if (outcome && outcome !== 'All') {
    query.recoveryOutcome = new RegExp(outcome.trim(), 'i');
  }
  if (from || to) {
    query.dischargeDate = {};
    if (from) query.dischargeDate.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query.dischargeDate.$lte = toDate;
    }
  }
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    const matchingPatients = await Patient.find({
      $or: [{ patientId: regex }, { name: regex }],
    }).select('_id');
    const patientIds = matchingPatients.map((p) => p._id);

    query.$or = [
      { finalDiagnosis: regex },
      { diagnosis: regex },
      { patient: { $in: patientIds } },
    ];
  }

  const total = await Admission.countDocuments(query);
  const skip = (Number(page) - 1) * Number(limit);

  const records = await Admission.find(query)
    .populate('patient', 'patientId name age gender phone')
    .populate('doctor', 'name specialization department')
    .populate('facility', 'name')
    .populate('bed', 'bedNumber')
    .sort({ dischargeDate: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    records,
  };
};

// GET /api/admissions
const getAdmissions = async (req, res) => {
  try {
    const admissions = await Admission.find()
      .populate('patient', 'patientId name age gender')
      .populate('doctor', 'name specialization department')
      .populate('facility', 'name department')
      .populate('bed', 'bedNumber')
      .sort({ admissionDate: -1 });

    return res.status(200).json({ success: true, count: admissions.length, admissions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admissions.', error: error.message });
  }
};

// GET /api/admissions/daily
const getDailyAdmissions = async (req, res) => {
  try {
    const data = await computeDailyAdmissions(req.query.week || 'current');
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admissions/discharged
const getDischargedPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', outcome = '', from = '', to = '' } = req.query;
    const data = await fetchDischargedPatients({ page, limit, search, outcome, from, to });
    return res.status(200).json({ success: true, count: data.records.length, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admissions/discharged/:id & /:id/file & /:id/discharge-summary
const getAdmissionFile = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
      .populate('patient', 'patientId name age gender bloodGroup phone address')
      .populate('doctor', 'name specialization department')
      .populate('facility', 'name department')
      .populate('bed', 'bedNumber');

    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission file not found.' });
    }

    return res.status(200).json({ success: true, file: admission });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admissions/overview
const getAdmissionsOverview = async (req, res) => {
  try {
    const { week = 'current', page = 1, limit = 10 } = req.query;
    const [dailyAdmissions, totalAdmissions, totalDischarged, dischargedList, outcomeAgg] = await Promise.all([
      computeDailyAdmissions(week),
      Admission.countDocuments(),
      Admission.countDocuments({ status: 'Discharged' }),
      fetchDischargedPatients({ page, limit }),
      Admission.aggregate([
        { $match: { status: 'Discharged' } },
        { $group: { _id: { $ifNull: ['$recoveryOutcome', 'Recovered & Discharged'] }, count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      overview: {
        dailyAdmissions,
        totalAdmissions,
        totalDischarged,
        dischargedList,
        recoveryOutcomeSummary: outcomeAgg.map((o) => ({ outcome: o._id, count: o.count })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admissions
const createAdmission = async (req, res) => {
  try {
    const { patient, doctor, attendingDoctor, facility, bed: bedId, diagnosis, admissionReason, ward, bedNumber, department } = req.body;
    const doctorId = attendingDoctor || doctor;

    let bedDoc;
    if (facility) {
      bedDoc = bedId
        ? await Bed.findOne({ _id: bedId, facility, status: 'Available' })
        : await Bed.findOne({ facility, status: 'Available' });

      if (!bedDoc) {
        return res.status(400).json({ success: false, message: 'No available beds in the selected facility.' });
      }
    }

    const admission = await Admission.create({
      patient,
      doctor: doctorId,
      facility,
      bed: bedDoc?._id,
      ward: ward || '',
      bedNumber: bedNumber || bedDoc?.bedNumber || '',
      department: department || '',
      diagnosis: diagnosis || admissionReason || '',
      admissionReason: admissionReason || diagnosis || '',
      status: 'Admitted',
      createdBy: req.admin._id,
    });

    if (bedDoc) {
      bedDoc.status = 'Occupied';
      bedDoc.currentPatient = patient;
      await bedDoc.save();
    }

    await Patient.findByIdAndUpdate(patient, { status: 'Inpatient', assignedDoctor: doctorId });

    const populated = await Admission.findById(admission._id)
      .populate('patient', 'patientId name age')
      .populate('doctor', 'name specialization')
      .populate('facility', 'name')
      .populate('bed', 'bedNumber');

    return res.status(201).json({
      success: true,
      message: 'Patient admitted successfully.',
      admission: populated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/admissions/:id
const updateAdmission = async (req, res) => {
  try {
    const admission = await Admission.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
      .populate('patient', 'patientId name age')
      .populate('doctor', 'name specialization');

    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission record not found.' });
    }

    return res.status(200).json({ success: true, message: 'Admission updated.', admission });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/admissions/:id/status
const updateAdmissionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Admitted', 'Discharged', 'Transferred'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid admission status.' });
    }
    const admission = await Admission.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!admission) return res.status(404).json({ success: false, message: 'Admission record not found.' });
    return res.status(200).json({ success: true, message: 'Admission status updated.', admission });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/admissions/:id/discharge
const dischargePatient = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission record not found.' });
    }
    if (admission.status === 'Discharged') {
      return res.status(400).json({ success: false, message: 'Patient is already discharged.' });
    }

    const { finalDiagnosis, recoveryOutcome, dischargeSummary, treatmentGiven, followUpDate, prescriptionsOnDischarge } = req.body || {};

    admission.status = 'Discharged';
    admission.dischargeDate = new Date();
    if (finalDiagnosis) admission.finalDiagnosis = finalDiagnosis;
    if (recoveryOutcome) admission.recoveryOutcome = recoveryOutcome;
    if (dischargeSummary) admission.dischargeSummary = dischargeSummary;
    if (treatmentGiven) admission.treatmentGiven = treatmentGiven;
    if (followUpDate) admission.followUpDate = followUpDate;
    if (prescriptionsOnDischarge) admission.prescriptionsOnDischarge = prescriptionsOnDischarge;
    await admission.save();

    if (admission.bed) {
      await Bed.findByIdAndUpdate(admission.bed, { status: 'Available', currentPatient: null });
    }

    await Patient.findByIdAndUpdate(admission.patient, { status: 'Discharged' });

    return res.status(200).json({
      success: true,
      message: 'Patient discharged successfully.',
      admission,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to discharge patient.', error: error.message });
  }
};

module.exports = {
  getAdmissions,
  getDailyAdmissions,
  getDischargedPatients,
  getAdmissionFile,
  getAdmissionsOverview,
  createAdmission,
  updateAdmission,
  updateAdmissionStatus,
  dischargePatient,
};
