const Patient = require("../models/Patient");
const { buildIdOrCodeFilter } = require("../utils/findByIdOrCode");

// POST /api/patients
const createPatient = async (req, res) => {
  try {
    const body = req.body || {};
    const name = body.name || body.fullName;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Patient name is required." });
    }

    const patient = await Patient.create({
      patientId: body.patientId,
      name: String(name).trim(),
      age: body.age !== undefined ? Number(body.age) : 0,
      gender: body.gender || body.sex || "Male",
      phone: body.phone || "",
      email: body.email || "",
      bloodGroup: body.bloodGroup || "O+",
      status: body.status || "Admitted",
      department: body.department || "General Medicine",
      doctor: body.doctor || "Unassigned",
      admissionDate: body.admissionDate || Date.now(),
      room: body.room || "General Ward",
      diagnosis: body.diagnosis || "Under Evaluation",
      vitals: body.vitals,
      prescriptions: Array.isArray(body.prescriptions) ? body.prescriptions : [],
      emergencyContact: body.emergencyContact || "",
      address: body.address || "",
      createdBy: req.user?.id || req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Patient saved to database.",
      patient,
      data: patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create patient.",
      error: error.message,
    });
  }
};

// GET /api/patients
const getPatients = async (req, res) => {
  try {
    const { search = "", status = "", department = "" } = req.query;
    const query = {};

    if (status && status !== "All") query.status = status;
    if (department && department !== "All") query.department = department;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ patientId: regex }, { name: regex }, { phone: regex }, { email: regex }];
    }

    const patients = await Patient.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: patients.length,
      total: patients.length,
      patients,
      data: patients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patients.",
      error: error.message,
    });
  }
};

// GET /api/patients/:id
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findOne(buildIdOrCodeFilter(req.params.id, "patientId")).lean();
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found." });
    }
    return res.status(200).json({ success: true, patient, data: patient });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient.",
      error: error.message,
    });
  }
};

// PUT /api/patients/:id
const updatePatient = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.status === "Discharged" && !updates.dischargeDate) {
      updates.dischargeDate = new Date();
    }

    const patient = await Patient.findOneAndUpdate(
      buildIdOrCodeFilter(req.params.id, "patientId"),
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Patient updated successfully.",
      patient,
      data: patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update patient.",
      error: error.message,
    });
  }
};

// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findOneAndDelete(buildIdOrCodeFilter(req.params.id, "patientId"));
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Patient deleted successfully.",
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete patient.",
      error: error.message,
    });
  }
};

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};
