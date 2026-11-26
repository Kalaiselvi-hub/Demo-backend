const HospitalPrice = require('../models/HospitalPrice');

// GET /api/hospital/prices
const getHospitalPrices = async (req, res) => {
  try {
    const { category, department } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (department) filter.department = department;

    const prices = await HospitalPrice.find(filter).sort({ category: 1, serviceName: 1 });
    return res.status(200).json({ success: true, count: prices.length, prices });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch hospital price catalogue.', error: error.message });
  }
};

module.exports = { getHospitalPrices };
