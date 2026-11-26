const Facility = require('../models/Facility');

// GET /api/facilities
const getFacilities = async (req, res) => {
  try {
    const facilities = await Facility.find({ isActive: { $ne: false } }).sort({ facilityId: 1, name: 1 }).lean();
    const formatted = facilities.map((f) => {
      const cap = f.totalCapacity ?? f.totalBeds ?? 0;
      const free = typeof cap === 'number' ? Math.max(0, cap - (f.currentLoad || 0)) : f.freeCapacity || 0;
      return {
        ...f,
        facilityName: f.name,
        totalCapacity: cap,
        freeCapacity: free,
      };
    });

    return res.status(200).json({
      success: true,
      totalFacilities: formatted.length,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch facilities.', error: error.message });
  }
};

// GET /api/facilities/:id
const getFacilityById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { facilityId: req.params.id.toUpperCase() };

    const facility = await Facility.findOne(filter).lean();
    if (!facility) return res.status(404).json({ success: false, message: 'Facility not found.' });
    return res.status(200).json({ success: true, data: facility });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/facilities
const createFacility = async (req, res) => {
  try {
    const { facilityName, name, totalCapacity, totalBeds, currentLoad = 0, ...rest } = req.body;
    const cap = totalCapacity ?? totalBeds ?? 0;
    const facility = await Facility.create({
      ...rest,
      name: facilityName || name,
      totalCapacity: cap,
      totalBeds: typeof cap === 'number' ? cap : 0,
      currentLoad,
    });
    return res.status(201).json({ success: true, message: 'Facility created successfully.', data: facility });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/facilities/:id
const updateFacility = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.facilityName) updates.name = updates.facilityName;
    const facility = await Facility.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!facility) return res.status(404).json({ success: false, message: 'Facility not found.' });
    return res.status(200).json({ success: true, message: 'Facility updated.', data: facility });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/facilities/:id/status
const updateFacilityStatus = async (req, res) => {
  try {
    const { status, currentLoad, currentLoadText, note } = req.body;
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { facilityId: req.params.id.toUpperCase() };

    const facility = await Facility.findOne(filter);
    if (!facility) return res.status(404).json({ success: false, message: 'Facility not found.' });

    if (status) facility.status = status;
    if (currentLoad !== undefined) facility.currentLoad = Number(currentLoad);
    if (currentLoadText !== undefined) facility.currentLoadText = currentLoadText;
    if (note !== undefined) facility.note = note;

    if (typeof facility.totalCapacity === 'number') {
      facility.freeCapacity = Math.max(0, facility.totalCapacity - (facility.currentLoad || 0));
    }

    await facility.save();
    return res.status(200).json({ success: true, message: 'Facility status updated.', data: facility });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  updateFacilityStatus,
};
