const Equipment = require('../models/Equipment');
const MaintenanceLog = require('../models/MaintenanceLog');

const computeOperationalStatus = (eqp) => {
  if (eqp.underMaintenance) return 'Under Maintenance';
  const now = new Date();
  const nextCal = new Date(eqp.nextCalibration);
  const diffDays = Math.ceil((nextCal - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  if (diffDays <= 30) return 'Service Due';
  return 'Operational';
};

const enrichEquipment = (eqp) => ({
  ...eqp,
  operationalStatus: computeOperationalStatus(eqp),
});

// GET /api/equipment/stats/summary
const getEquipmentSummary = async (req, res) => {
  try {
    const list = await Equipment.find({ isActive: { $ne: false } }).lean();
    const enriched = list.map(enrichEquipment);

    const operationalCount = enriched.filter((e) => e.operationalStatus === 'Operational').length;
    const serviceDueCount = enriched.filter((e) => e.operationalStatus === 'Service Due').length;
    const overdueCount = enriched.filter((e) => e.operationalStatus === 'Overdue').length;
    const underMaintenanceCount = enriched.filter((e) => e.operationalStatus === 'Under Maintenance').length;

    return res.status(200).json({
      success: true,
      data: {
        totalEquipment: enriched.length,
        operationalCount,
        serviceDueCount,
        overdueCount,
        underMaintenanceCount,
        majorSystemsOnline: operationalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/equipment?search=&department=&status=
const getEquipment = async (req, res) => {
  try {
    const { search = '', department = '', status = '' } = req.query;
    const filter = { isActive: { $ne: false } };

    if (department && department !== 'All') filter.department = new RegExp(`^${department.trim()}$`, 'i');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { equipmentDescription: regex },
        { assetId: regex },
        { serialNumber: regex },
        { department: regex },
      ];
    }

    const list = await Equipment.find(filter).sort({ nextCalibration: 1 }).lean();
    let enriched = list.map(enrichEquipment);

    if (status && status !== 'All') {
      enriched = enriched.filter((e) => e.operationalStatus.toLowerCase() === status.trim().toLowerCase());
    }

    return res.status(200).json({ success: true, total: enriched.length, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/equipment/service-due
const getServiceDueEquipment = async (req, res) => {
  try {
    const list = await Equipment.find({ isActive: { $ne: false } }).sort({ nextCalibration: 1 }).lean();
    const due = list
      .map(enrichEquipment)
      .filter((e) => e.operationalStatus === 'Service Due' || e.operationalStatus === 'Overdue');
    return res.status(200).json({ success: true, total: due.length, data: due });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/equipment/:id
const getEquipmentById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ assetId: req.params.id.toUpperCase() }, { equipmentId: req.params.id.toUpperCase() }] };

    const eqp = await Equipment.findOne(filter).lean();
    if (!eqp) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    return res.status(200).json({ success: true, data: enrichEquipment(eqp) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/equipment
const createEquipment = async (req, res) => {
  try {
    const { lastServiced, nextCalibration } = req.body;
    if (lastServiced && nextCalibration && new Date(nextCalibration) <= new Date(lastServiced)) {
      return res.status(400).json({ success: false, message: 'nextCalibration must be after lastServiced.' });
    }
    const eqp = await Equipment.create(req.body);
    return res.status(201).json({
      success: true,
      message: 'Equipment added successfully.',
      data: enrichEquipment(eqp.toObject()),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/equipment/:id
const updateEquipment = async (req, res) => {
  try {
    const eqp = await Equipment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!eqp) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    return res.status(200).json({ success: true, message: 'Equipment updated.', data: enrichEquipment(eqp) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/equipment/:id/service
const updateEquipmentService = async (req, res) => {
  try {
    const { lastServiced, nextCalibration, serviceNotes = '', servicedBy = 'Biomedical Engineer' } = req.body;
    if (!lastServiced || !nextCalibration) {
      return res.status(400).json({ success: false, message: 'lastServiced and nextCalibration are required.' });
    }
    if (new Date(nextCalibration) <= new Date(lastServiced)) {
      return res.status(400).json({ success: false, message: 'nextCalibration must be after lastServiced.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ assetId: req.params.id.toUpperCase() }, { equipmentId: req.params.id.toUpperCase() }] };

    const eqp = await Equipment.findOne(filter);
    if (!eqp) return res.status(404).json({ success: false, message: 'Equipment not found.' });

    eqp.lastServiced = new Date(lastServiced);
    eqp.nextCalibration = new Date(nextCalibration);
    eqp.serviceNotes = serviceNotes;
    eqp.servicedBy = servicedBy;
    eqp.underMaintenance = false;
    await eqp.save();

    await MaintenanceLog.create({
      equipment: eqp._id,
      equipmentId: eqp.equipmentId,
      lastServiced: eqp.lastServiced,
      nextCalibration: eqp.nextCalibration,
      serviceNotes,
      servicedBy,
    });

    return res.status(200).json({
      success: true,
      message: 'Service calibration updated successfully.',
      data: enrichEquipment(eqp.toObject()),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/equipment/:id
const deleteEquipment = async (req, res) => {
  try {
    const deleted = await Equipment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    return res.status(200).json({ success: true, message: 'Equipment deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/equipment/export/csv
const exportEquipmentCsv = async (req, res) => {
  try {
    const list = await Equipment.find({ isActive: { $ne: false } }).sort({ assetId: 1 }).lean();
    const enriched = list.map(enrichEquipment);
    const headers = ['Asset ID', 'Equipment Description', 'Model / Specs', 'Department', 'Serial Number', 'Last Serviced', 'Next Calibration', 'Status'];
    const rows = enriched.map((e) =>
      [e.assetId, e.equipmentDescription, e.modelSpecs, e.department, e.serialNumber, e.lastServiced, e.nextCalibration, e.operationalStatus]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="biomedical-equipment.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/equipment/export/pdf
const exportEquipmentPdf = async (req, res) => {
  try {
    const list = await Equipment.find({ isActive: { $ne: false } }).sort({ assetId: 1 }).lean();
    const enriched = list.map(enrichEquipment);
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - BIOMEDICAL EQUIPMENT & DIAGNOSTIC MACHINERY',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...enriched.map((e) => `${e.assetId} | ${e.equipmentDescription} | ${e.department} | SN: ${e.serialNumber} | ${e.operationalStatus}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="biomedical-equipment.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEquipmentSummary,
  getEquipment,
  getServiceDueEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  updateEquipmentService,
  deleteEquipment,
  exportEquipmentCsv,
  exportEquipmentPdf,
};
