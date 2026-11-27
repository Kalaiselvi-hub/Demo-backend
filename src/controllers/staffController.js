const Staff = require("../models/Staff");
const { buildIdOrCodeFilter } = require("../utils/findByIdOrCode");

// POST /api/staff
const createStaff = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ success: false, message: "Staff name is required." });
    }

    const staff = await Staff.create({
      staffId: body.staffId,
      name: String(body.name).trim(),
      role: body.role || "Nurse",
      department: body.department || "General",
      phone: body.phone || "",
      email: body.email || "",
      shift: body.shift || "Morning (08:00 - 16:00)",
      joinDate: body.joinDate || Date.now(),
      status: body.status || "Active",
      createdBy: req.user?.id || req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Staff member saved to database.",
      staff,
      data: staff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create staff member.",
      error: error.message,
    });
  }
};

// GET /api/staff
const getStaff = async (req, res) => {
  try {
    const { search = "", department = "", role = "", status = "" } = req.query;
    const query = {};

    if (department && department !== "All") query.department = department;
    if (role && role !== "All") query.role = role;
    if (status && status !== "All") query.status = status;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ name: regex }, { staffId: regex }, { role: regex }, { department: regex }];
    }

    const staff = await Staff.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: staff.length,
      total: staff.length,
      staff,
      data: staff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff.",
      error: error.message,
    });
  }
};

// PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndUpdate(
      buildIdOrCodeFilter(req.params.id, "staffId"),
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Staff member updated successfully.",
      staff,
      data: staff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update staff member.",
      error: error.message,
    });
  }
};

// DELETE /api/staff/:id
const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete(buildIdOrCodeFilter(req.params.id, "staffId"));
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Staff member deleted successfully.",
      staff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete staff member.",
      error: error.message,
    });
  }
};

module.exports = {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
};
