const Service = require('../models/Service');

// GET /api/services?search=&department=
const getServices = async (req, res) => {
  try {
    const { search = '', department = '' } = req.query;
    const filter = { isActive: true };

    if (department && department !== 'All') {
      filter.departmentCategory = new RegExp(department.trim(), 'i');
    }
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ serviceName: regex }, { code: regex }];
    }

    const services = await Service.find(filter).sort({ code: 1, createdAt: -1 }).lean();
    const formatted = services.map((s) => ({
      ...s,
      procedureName: s.serviceName,
      averageDuration: s.standardDuration,
      needsSpecialPrepLabel: s.needsSpecialPrep ? 'YES' : 'NO',
      standardTariff: s.standardTariff || s.price || 0,
    }));

    return res.status(200).json({ success: true, total: formatted.length, count: formatted.length, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/services/:id (supports _id or code)
const getServiceById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { code: req.params.id.toUpperCase() };

    const service = await Service.findOne(filter).lean();
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/services
const createService = async (req, res) => {
  try {
    const {
      serviceName,
      departmentCategory,
      category,
      clinicalPreparationInstructions,
      standardDuration,
      standardTariff,
      price,
      needsSpecialPrep,
      departmentCode,
    } = req.body;

    const dept = departmentCategory || departmentCode || 'General Medicine';
    const tariff = Number(standardTariff ?? price ?? 0);

    if (!serviceName || tariff <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Service Name and Standard Tariff (> 0) are required.',
      });
    }

    const duplicate = await Service.findOne({
      serviceName: new RegExp(`^${serviceName.trim()}$`, 'i'),
      departmentCategory: new RegExp(`^${dept.trim()}$`, 'i'),
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Service already exists in this department',
      });
    }

    const service = await Service.create({
      serviceName: serviceName.trim(),
      departmentCategory: dept,
      category: category || 'Surgical Procedures',
      clinicalPreparationInstructions: clinicalPreparationInstructions || '',
      standardDuration: standardDuration || '30 mins',
      standardTariff: tariff,
      price: tariff,
      needsSpecialPrep: Boolean(needsSpecialPrep),
      departmentCode,
    });

    return res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: {
        _id: service._id,
        code: service.code,
        serviceName: service.serviceName,
        departmentCategory: service.departmentCategory,
        averageDuration: service.standardDuration,
        needsSpecialPrep: service.needsSpecialPrep ? 'YES' : 'NO',
        standardTariff: service.standardTariff,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/services/:id
const updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    return res.status(200).json({ success: true, message: 'Service updated.', data: service });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/services/:id
const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    return res.status(200).json({ success: true, message: 'Service deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/services/by-category & /api/services/stats
const getServicesByCategory = async (req, res) => {
  try {
    const [totalServices, agg] = await Promise.all([
      Service.countDocuments({ isActive: true }),
      Service.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const data = agg.map((item) => ({
      category: item._id,
      count: item.count,
      percentage: totalServices === 0 ? 0 : Number(((item.count / totalServices) * 100).toFixed(2)),
    }));

    return res.status(200).json({
      success: true,
      totalServices,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to aggregate services.', error: error.message });
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServicesByCategory,
};
