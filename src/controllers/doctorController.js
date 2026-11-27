const Doctor = require("../models/Doctor");
const { buildIdOrCodeFilter } = require("../utils/findByIdOrCode");

// POST /api/doctors
const createDoctor = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ success: false, message: "Doctor name is required." });
    }

    const doctor = await Doctor.create({
      doctorId: body.doctorId,
      name: String(body.name).trim(),
      email: body.email || "",
      phone: body.phone || "",
      specialization: body.specialization || "General Medicine",
      department: body.department || "General Medicine",
      qualifications: body.qualifications || body.qualification || "MBBS, MD",
      experienceYears: body.experienceYears !== undefined ? Number(body.experienceYears) : parseInt(body.experience, 10) || 5,
      consultationFee: body.consultationFee !== undefined ? Number(body.consultationFee) : Number(body.fee) || 500,
      rating: body.rating !== undefined ? Number(body.rating) : 4.8,
      status: body.status || "On Duty",
      availability: body.availability || "Mon-Fri 9AM-5PM",
      avatar: body.avatar || "",
      schedule: body.schedule,
      createdBy: req.user?.id || req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Doctor saved to database.",
      doctor,
      data: doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create doctor.",
      error: error.message,
    });
  }
};

// GET /api/doctors
const getDoctors = async (req, res) => {
  try {
    const { search = "", department = "", status = "" } = req.query;
    const query = {};

    if (department && department !== "All" && department !== "All Departments") {
      query.department = new RegExp(department.trim(), "i");
    }
    if (status && status !== "All") {
      query.status = status;
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ name: regex }, { specialization: regex }, { doctorId: regex }, { email: regex }];
    }

    const doctors = await Doctor.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: doctors.length,
      total: doctors.length,
      doctors,
      data: doctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors.",
      error: error.message,
    });
  }
};

// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      buildIdOrCodeFilter(req.params.id, "doctorId"),
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor updated successfully.",
      doctor,
      data: doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update doctor.",
      error: error.message,
    });
  }
};

// DELETE /api/doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOneAndDelete(buildIdOrCodeFilter(req.params.id, "doctorId"));
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Doctor deleted successfully.",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete doctor.",
      error: error.message,
    });
  }
};

module.exports = {
  createDoctor,
  getDoctors,
  updateDoctor,
  deleteDoctor,
};
