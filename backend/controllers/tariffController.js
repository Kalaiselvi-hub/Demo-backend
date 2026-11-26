const Service = require('../models/Service');

const TARIFF_CATEGORIES = ['Consultation', 'Emergency', 'Inpatient', 'Laboratory', 'Radiology', 'Surgical'];

// GET /api/tariffs?search=&category=
const getTariffs = async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;
    const filter = { isActive: true, serviceCode: { $exists: true, $ne: null } };

    if (category && category !== 'All') {
      filter.tariffCategory = new RegExp(`^${category.trim()}$`, 'i');
    }
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ serviceCode: regex }, { serviceName: regex }];
    }

    const tariffs = await Service.find(filter).sort({ serviceCode: 1 }).lean();
    const formatted = tariffs.map((t) => ({
      _id: t._id,
      serviceCode: t.serviceCode,
      serviceDescription: t.serviceName,
      category: t.tariffCategory || t.departmentCategory,
      hmoCoverage: t.hmoCoverage || '100% Covered',
      standardTariff: t.standardTariff || t.price || 0,
    }));

    return res.status(200).json({ success: true, total: formatted.length, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch tariffs.', error: error.message });
  }
};

// GET /api/tariffs/categories
const getTariffCategories = (req, res) => {
  return res.status(200).json({ success: true, categories: TARIFF_CATEGORIES });
};

// GET /api/tariffs/:id (supports _id or serviceCode)
const getTariffById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { serviceCode: req.params.id.toUpperCase() };

    const tariff = await Service.findOne(filter).lean();
    if (!tariff) return res.status(404).json({ success: false, message: 'Tariff not found.' });
    return res.status(200).json({ success: true, data: tariff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/tariffs
const createTariff = async (req, res) => {
  try {
    const { serviceCode, serviceDescription, serviceName, category, hmoCoverage, standardTariff } = req.body;
    const desc = (serviceDescription || serviceName || '').trim();
    if (!desc || standardTariff === undefined || Number(standardTariff) < 0) {
      return res.status(400).json({ success: false, message: 'Service description and valid tariff (>= 0) are required.' });
    }

    const count = await Service.countDocuments({ serviceCode: { $exists: true, $ne: null } });
    const generatedCode = serviceCode ? serviceCode.toUpperCase() : `CHG-${101 + count}`;

    const created = await Service.create({
      serviceCode: generatedCode,
      code: generatedCode,
      serviceName: desc,
      tariffCategory: category || 'Consultation',
      departmentCategory: category || 'Consultation',
      hmoCoverage: hmoCoverage || '100% Covered',
      standardTariff: Number(standardTariff),
      price: Number(standardTariff),
    });

    return res.status(201).json({
      success: true,
      message: 'Tariff created successfully.',
      data: {
        _id: created._id,
        serviceCode: created.serviceCode,
        serviceDescription: created.serviceName,
        category: created.tariffCategory,
        hmoCoverage: created.hmoCoverage,
        standardTariff: created.standardTariff,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/tariffs/:id
const updateTariff = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.serviceDescription) updates.serviceName = updates.serviceDescription;
    if (updates.category) updates.tariffCategory = updates.category;
    if (updates.standardTariff !== undefined) updates.price = updates.standardTariff;

    const updated = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Tariff not found.' });
    return res.status(200).json({ success: true, message: 'Tariff updated.', data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/tariffs/:id
const deleteTariff = async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Tariff not found.' });
    return res.status(200).json({ success: true, message: 'Tariff deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTariffs,
  getTariffCategories,
  getTariffById,
  createTariff,
  updateTariff,
  deleteTariff,
};
