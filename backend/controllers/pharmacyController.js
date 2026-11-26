const Medicine = require('../models/Medicine');
const StockTransaction = require('../models/StockTransaction');

const computeStatus = (stockLevel, reorderAt) => {
  if (stockLevel <= 0) return 'Out of Stock';
  if (stockLevel <= reorderAt * 0.5) return 'Critical Low';
  if (stockLevel < reorderAt) return 'Low Stock';
  return 'In Stock';
};

const enrichMedicine = (m) => {
  const status = computeStatus(m.stockLevel, m.reorderAt);
  const daysToExpiry = m.expiryDate ? Math.ceil((new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : 999;
  return {
    ...m,
    stockLevelLabel: `${m.stockLevel} Units`,
    status,
    expiringSoon: daysToExpiry <= 30,
  };
};

// GET /api/pharmacy/medicines/stats/summary
const getMedicineSummary = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: { $ne: false } }).lean();
    const enriched = medicines.map(enrichMedicine);

    const inStockCount = enriched.filter((m) => m.status === 'In Stock').length;
    const lowStockCount = enriched.filter((m) => m.status === 'Low Stock').length;
    const criticalLowCount = enriched.filter((m) => m.status === 'Critical Low').length;
    const outOfStockCount = enriched.filter((m) => m.status === 'Out of Stock').length;
    const expiringSoonCount = enriched.filter((m) => m.expiringSoon).length;
    const totalStockValue = enriched.reduce((sum, m) => sum + m.stockLevel * m.unitTariff, 0);

    return res.status(200).json({
      success: true,
      data: {
        totalMedicines: enriched.length,
        inStockCount,
        lowStockCount,
        criticalLowCount,
        lowStockWarningCount: lowStockCount + criticalLowCount + outOfStockCount,
        outOfStockCount,
        expiringSoonCount,
        totalStockValue,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/medicines?search=&category=&status=&sort=
const getMedicines = async (req, res) => {
  try {
    const { search = '', category = '', status = '', sort = 'code' } = req.query;
    const filter = { isActive: { $ne: false } };

    if (category && category !== 'All') filter.category = new RegExp(`^${category.trim()}$`, 'i');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ medicationName: regex }, { category: regex }, { code: regex }];
    }

    const sortObj =
      sort === 'expiryDate'
        ? { expiryDate: 1 }
        : sort === 'stockLevel'
        ? { stockLevel: 1 }
        : sort === 'medicationName'
        ? { medicationName: 1 }
        : { code: 1 };

    const medicines = await Medicine.find(filter).sort(sortObj).lean();
    let enriched = medicines.map(enrichMedicine);

    if (status && status !== 'All') {
      enriched = enriched.filter((m) => m.status.toLowerCase() === status.trim().toLowerCase());
    }

    return res.status(200).json({ success: true, total: enriched.length, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/medicines/low-stock
const getLowStockMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: { $ne: false } }).sort({ stockLevel: 1 }).lean();
    const lowStock = medicines.map(enrichMedicine).filter((m) => m.status !== 'In Stock');
    return res.status(200).json({ success: true, total: lowStock.length, data: lowStock });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/medicines/:id
const getMedicineById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ code: req.params.id.toUpperCase() }, { medicineId: req.params.id.toUpperCase() }] };

    const medicine = await Medicine.findOne(filter).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    return res.status(200).json({ success: true, data: enrichMedicine(medicine) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/pharmacy/medicines
const createMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.create(req.body);
    return res.status(201).json({
      success: true,
      message: 'Medicine added successfully.',
      data: enrichMedicine(medicine.toObject()),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/pharmacy/medicines/:id
const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    return res.status(200).json({ success: true, message: 'Medicine updated.', data: enrichMedicine(medicine) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/pharmacy/medicines/:id/adjust-stock
const adjustStock = async (req, res) => {
  try {
    const { quantity, type = 'add', reason = '', batchNumber = '', supplier = '', ward = '' } = req.body;
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ code: req.params.id.toUpperCase() }, { medicineId: req.params.id.toUpperCase() }] };

    const medicine = await Medicine.findOne(filter);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const previousStock = medicine.stockLevel;
    let newStock = previousStock;
    if (type === 'dispense') {
      if (previousStock - qty < 0) {
        return res.status(400).json({ success: false, message: 'Insufficient stock level.' });
      }
      newStock = previousStock - qty;
    } else {
      newStock = previousStock + qty;
    }

    medicine.stockLevel = newStock;
    await medicine.save();

    await StockTransaction.create({
      medicine: medicine._id,
      medicineId: medicine.medicineId,
      type,
      quantity: qty,
      previousStock,
      newStock,
      reason,
      batchNumber,
      supplier,
      ward,
      performedBy: req.admin?.name || 'Administrator',
    });

    return res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully.',
      data: enrichMedicine(medicine.toObject()),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/pharmacy/stock/batch-adjust
const batchAdjustStock = async (req, res) => {
  try {
    const { adjustments = [] } = req.body;
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({ success: false, message: 'adjustments array is required.' });
    }

    const results = [];
    for (const adj of adjustments) {
      const { medicineId, quantity, type = 'add', reason = '', batchNumber = '', supplier = '', ward = '' } = adj;
      const qty = Number(quantity);
      if (!medicineId || Number.isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Each adjustment requires medicineId and quantity > 0.' });
      }

      const medicine = await Medicine.findOne({
        $or: [{ code: String(medicineId).toUpperCase() }, { medicineId: String(medicineId).toUpperCase() }],
      });
      if (!medicine) {
        return res.status(404).json({ success: false, message: `Medicine ${medicineId} not found.` });
      }

      const previousStock = medicine.stockLevel;
      let newStock = previousStock;
      if (type === 'dispense') {
        if (previousStock - qty < 0) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${medicine.medicationName}.` });
        }
        newStock = previousStock - qty;
      } else {
        newStock = previousStock + qty;
      }

      medicine.stockLevel = newStock;
      await medicine.save();

      await StockTransaction.create({
        medicine: medicine._id,
        medicineId: medicine.medicineId,
        type,
        quantity: qty,
        previousStock,
        newStock,
        reason,
        batchNumber,
        supplier,
        ward,
        performedBy: req.admin?.name || 'Administrator',
      });

      results.push({
        medicineId: medicine.medicineId,
        medicationName: medicine.medicationName,
        previousStock,
        newStock,
        type,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Batch stock adjusted successfully',
      data: {
        totalAdjusted: results.length,
        results,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/stock/transactions?medicineId=
const getStockTransactions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.medicineId) filter.medicineId = req.query.medicineId.toUpperCase();
    const transactions = await StockTransaction.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, total: transactions.length, data: transactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/pharmacy/medicines/:id
const deleteMedicine = async (req, res) => {
  try {
    const deleted = await Medicine.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    return res.status(200).json({ success: true, message: 'Medicine deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/medicines/export/csv
const exportMedicinesCsv = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: { $ne: false } }).sort({ code: 1 }).lean();
    const enriched = medicines.map(enrichMedicine);
    const headers = ['Code', 'Medication Name', 'Category', 'Dosage Form', 'Stock Level', 'Reorder At', 'Unit Tariff (NGN)', 'Status'];
    const rows = enriched.map((m) =>
      [m.code, m.medicationName, m.category, m.dosageForm, m.stockLevel, m.reorderAt, m.unitTariff, m.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pharmacy-stock.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/medicines/export/pdf
const exportMedicinesPdf = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: { $ne: false } }).sort({ code: 1 }).lean();
    const enriched = medicines.map(enrichMedicine);
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - MEDICINE STOCK & PHARMACY DISPENSARY',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...enriched.map((m) => `${m.code} | ${m.medicationName} | Stock: ${m.stockLevel} | Tariff: NGN ${m.unitTariff} | ${m.status}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pharmacy-stock.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMedicineSummary,
  getMedicines,
  getLowStockMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  adjustStock,
  batchAdjustStock,
  getStockTransactions,
  deleteMedicine,
  exportMedicinesCsv,
  exportMedicinesPdf,
};
