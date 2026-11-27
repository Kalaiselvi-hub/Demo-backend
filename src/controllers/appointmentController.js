const Appointment = require("../models/Appointment");
const { buildIdOrCodeFilter } = require("../utils/findByIdOrCode");

// POST /api/appointments/book
const bookAppointment = async (req, res) => {
  try {
    const body = req.body || {};
    const patientName = body.patientFullName || body.patientName;
    if (!patientName || !String(patientName).trim()) {
      return res.status(400).json({ success: false, message: "Patient name is required." });
    }

    const appointment = await Appointment.create({
      appointmentId: body.appointmentId,
      patient: body.patientId || body.patient,
      patientFullName: String(patientName).trim(),
      patientAge: body.patientAge !== undefined ? Number(body.patientAge) : 30,
      contactPhoneNumber: body.contactPhoneNumber || body.patientPhone || "",
      doctor: body.doctorId || body.doctor,
      consultingPhysician: body.consultingPhysician || body.doctorName || (typeof body.doctor === "string" ? body.doctor : "Doctor"),
      department: body.department || "General Medicine",
      appointmentDate: body.appointmentDate || body.date || new Date(),
      timeSlot: body.timeSlot || body.time || "10:00 AM",
      reason: body.reason || "Routine Medical Checkup",
      appointmentType: body.appointmentType || body.type || "Consultation",
      priority: body.priority || "Normal",
      status: body.status || "Pending",
      notes: body.notes || "",
      createdBy: req.user?.id || req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Appointment booked and saved to database.",
      appointment,
      data: appointment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment.",
      error: error.message,
    });
  }
};

// GET /api/appointments
const getAppointments = async (req, res) => {
  try {
    const { status = "", department = "", date = "", search = "" } = req.query;
    const query = {};

    if (status && status !== "All") query.status = status;
    if (department && department !== "All") query.department = new RegExp(department.trim(), "i");
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: start, $lte: end };
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { appointmentId: regex },
        { patientFullName: regex },
        { consultingPhysician: regex },
        { contactPhoneNumber: regex },
      ];
    }

    const appointments = await Appointment.find(query)
      .populate("patient", "patientId name phone age gender")
      .populate("doctor", "doctorId name specialization department")
      .sort({ appointmentDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: appointments.length,
      total: appointments.length,
      appointments,
      data: appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments.",
      error: error.message,
    });
  }
};

// PUT /api/appointments/:id
const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      buildIdOrCodeFilter(req.params.id, "appointmentId"),
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully.",
      appointment,
      data: appointment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update appointment.",
      error: error.message,
    });
  }
};

// DELETE /api/appointments/:id
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete(buildIdOrCodeFilter(req.params.id, "appointmentId"));
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Appointment deleted successfully.",
      appointment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete appointment.",
      error: error.message,
    });
  }
};

module.exports = {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
};
