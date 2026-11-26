const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

const buildFilterQuery = async ({ search = '', status = '', department = '' }) => {
  const query = {};
  if (status && status !== 'All') {
    query.status = status;
  }
  if (department && department !== 'All') {
    query.department = new RegExp(department.trim(), 'i');
  }
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    const matchingPatients = await Patient.find({
      $or: [{ patientId: regex }, { name: regex }],
    }).select('_id');
    const patientIds = matchingPatients.map((p) => p._id);

    query.$or = [{ diagnosis: regex }, { patient: { $in: patientIds } }];
  }
  return query;
};

// GET /api/clinical-records
const getClinicalRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', department = '' } = req.query;
    const query = await buildFilterQuery({ search, status, department });

    const total = await ClinicalRecord.countDocuments(query);
    const skip = (Number(page) - 1) * Number(limit);

    const records = await ClinicalRecord.find(query)
      .populate('patient', 'patientId name age gender bloodGroup phone')
      .populate('assignedDoctor', 'name specialization department')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      count: records.length,
      records,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch clinical records.', error: error.message });
  }
};

// GET /api/clinical-records/export
const exportClinicalRecords = async (req, res) => {
  try {
    const { format = 'csv', search = '', status = '', department = '' } = req.query;
    const query = await buildFilterQuery({ search, status, department });

    const records = await ClinicalRecord.find(query)
      .populate('patient', 'patientId name age gender bloodGroup')
      .populate('assignedDoctor', 'name')
      .sort({ updatedAt: -1 })
      .lean();

    if (format.toLowerCase() === 'json') {
      return res.status(200).json({ success: true, count: records.length, records });
    }

    const headers = ['Patient ID', 'Name', 'Age', 'Sex', 'Blood', 'Diagnosis', 'Doctor', 'Department', 'Status'];
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = records.map((r) =>
      [
        r.patient?.patientId || '',
        r.patient?.name || '',
        r.patient?.age || '',
        r.patient?.gender || '',
        r.patient?.bloodGroup || '',
        r.diagnosis || '',
        r.assignedDoctor?.name || '',
        r.department || '',
        r.status || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clinical-records.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to export clinical records.', error: error.message });
  }
};

// GET /api/clinical-records/patient/:patientId
const getRecordsByPatient = async (req, res) => {
  try {
    const records = await ClinicalRecord.find({ patient: req.params.patientId })
      .populate('patient', 'patientId name age gender bloodGroup phone')
      .populate('assignedDoctor', 'name specialization department')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, count: records.length, records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/clinical-records/:id & /:id/details
const getClinicalRecordById = async (req, res) => {
  try {
    const record = await ClinicalRecord.findById(req.params.id)
      .populate('patient', 'patientId name age gender bloodGroup phone address')
      .populate('assignedDoctor', 'name specialization department');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    }

    return res.status(200).json({ success: true, record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/clinical-records/:id/vitals
const getRecordVitals = async (req, res) => {
  try {
    const record = await ClinicalRecord.findById(req.params.id).select('vitalSigns patient');
    if (!record) return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    return res.status(200).json({ success: true, vitalSigns: record.vitalSigns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/clinical-records/:id/labs
const getRecordLabs = async (req, res) => {
  try {
    const record = await ClinicalRecord.findById(req.params.id).select('labResults patient');
    if (!record) return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    return res.status(200).json({ success: true, labResults: record.labResults });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/clinical-records/:id/prescriptions
const getRecordPrescriptions = async (req, res) => {
  try {
    const record = await ClinicalRecord.findById(req.params.id).select('prescriptions patient');
    if (!record) return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    return res.status(200).json({ success: true, prescriptions: record.prescriptions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/clinical-records/:id/notes
const getRecordNotes = async (req, res) => {
  try {
    const record = await ClinicalRecord.findById(req.params.id).select('doctorNotes treatmentPlan patient');
    if (!record) return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    return res.status(200).json({
      success: true,
      doctorNotes: record.doctorNotes,
      treatmentPlan: record.treatmentPlan,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/clinical-records
const createClinicalRecord = async (req, res) => {
  try {
    const patientExists = await Patient.findById(req.body.patient);
    if (!patientExists) {
      return res.status(404).json({ success: false, message: 'Referenced patient not found.' });
    }

    const record = await ClinicalRecord.create({
      ...req.body,
      createdBy: req.admin._id,
    });

    const populated = await ClinicalRecord.findById(record._id)
      .populate('patient', 'patientId name age gender bloodGroup phone')
      .populate('assignedDoctor', 'name specialization department');

    return res.status(201).json({
      success: true,
      message: 'Clinical record created successfully.',
      record: populated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/clinical-records/:id
const updateClinicalRecord = async (req, res) => {
  try {
    const record = await ClinicalRecord.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('patient', 'patientId name age gender bloodGroup phone')
      .populate('assignedDoctor', 'name specialization department');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Clinical record updated successfully.',
      record,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/clinical-records/:id/status
const updateClinicalStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Active', 'Recovering', 'Critical', 'Stable'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid clinical status.' });
    }

    const record = await ClinicalRecord.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate('patient', 'patientId name age gender bloodGroup')
      .populate('assignedDoctor', 'name specialization department');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    }

    return res.status(200).json({ success: true, message: 'Clinical status updated.', record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/clinical-records/:id
const deleteClinicalRecord = async (req, res) => {
  try {
    const record = await ClinicalRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Clinical record not found.' });
    }
    return res.status(200).json({ success: true, message: 'Clinical record deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getClinicalRecords,
  exportClinicalRecords,
  getRecordsByPatient,
  getClinicalRecordById,
  getRecordVitals,
  getRecordLabs,
  getRecordPrescriptions,
  getRecordNotes,
  createClinicalRecord,
  updateClinicalRecord,
  updateClinicalStatus,
  deleteClinicalRecord,
};
