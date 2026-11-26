const Medicine = require('../models/Medicine');
const PurchaseOrder = require('../models/PurchaseOrder');
const StockTransaction = require('../models/StockTransaction');

const computeAlertRows = async () => {
  const medicines = await Medicine.find({
    isActive: { $ne: false },
    $expr: { $lt: ['$stockLevel', '$reorderAt'] },
  })
    .sort({ stockLevel: 1 })
    .lean();

  return medicines.map((m) => {
    const status = m.stockLevel <= 0 ? 'Out of Stock' : m.stockLevel <= m.reorderAt * 0.5 ? 'Critical Low' : 'Low Stock';
    const estimatedCost = (m.unitTariff || 0) * 100;
    const reorderQuantity = Math.max(1, (m.reorderAt || 0) - (m.stockLevel || 0));

    return {
      _id: m._id,
      medicineId: m.medicineId || m.code,
      code: m.code,
      medicationName: m.medicationName,
      dosageForm: m.dosageForm,
      category: m.category,
      currentStock: m.stockLevel,
      currentStockLabel: `${m.stockLevel} Units`,
      safeMinimum: m.reorderAt,
      safeMinimumLabel: `${m.reorderAt} Units`,
      reorderQuantity,
      expiryDate: m.expiryDate,
      unitTariff: m.unitTariff,
      estimatedCost,
      status,
      alertStatus: 'Urgent',
    };
  });
};

// GET /api/pharmacy/alerts/critical-low-stock
const getCriticalLowStock = async (req, res) => {
  try {
    const data = await computeAlertRows();
    return res.status(200).json({ success: true, total: data.length, urgentItems: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/alerts/stats/summary
const getAlertsSummary = async (req, res) => {
  try {
    const data = await computeAlertRows();
    const criticalLowCount = data.filter((d) => d.status === 'Critical Low').length;
    const lowStockCount = data.filter((d) => d.status === 'Low Stock').length;
    const totalEstimatedCost = data.reduce((sum, d) => sum + d.estimatedCost, 0);

    return res.status(200).json({
      success: true,
      data: {
        urgentItems: data.length,
        criticalLowCount,
        lowStockCount,
        totalEstimatedCost,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/pharmacy/purchase-orders
const createPurchaseOrder = async (req, res) => {
  try {
    const { medicineId, quantity, supplier = 'Licensed Manufacturer', notes = '' } = req.body;
    if (!medicineId) return res.status(400).json({ success: false, message: 'medicineId is required.' });

    const medicine = await Medicine.findOne({
      $or: [{ code: String(medicineId).toUpperCase() }, { medicineId: String(medicineId).toUpperCase() }],
    });
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const qty = Number(quantity) || Math.max(1, medicine.reorderAt - medicine.stockLevel);
    if (qty <= 0) return res.status(400).json({ success: false, message: 'Quantity must be > 0.' });

    const po = await PurchaseOrder.create({
      medicine: medicine._id,
      medicineId: medicine.medicineId,
      medicationName: medicine.medicationName,
      category: medicine.category,
      quantity: qty,
      unitTariff: medicine.unitTariff,
      estimatedCost: medicine.unitTariff * 100,
      supplier,
      notes,
      createdBy: req.admin?.name || 'Administrator',
    });

    return res.status(201).json({ success: true, message: 'Re-Order PO created successfully', data: po });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/pharmacy/purchase-orders/batch
const createBatchPurchaseOrders = async (req, res) => {
  try {
    const { medicineIds = [], supplier = 'Licensed Manufacturer' } = req.body;
    if (!Array.isArray(medicineIds) || medicineIds.length === 0) {
      return res.status(400).json({ success: false, message: 'medicineIds array is required.' });
    }

    const createdPOs = [];
    for (const mId of medicineIds) {
      const medicine = await Medicine.findOne({
        $or: [{ code: String(mId).toUpperCase() }, { medicineId: String(mId).toUpperCase() }],
      });
      if (!medicine) continue;

      const qty = Math.max(1, medicine.reorderAt - medicine.stockLevel);
      const po = await PurchaseOrder.create({
        medicine: medicine._id,
        medicineId: medicine.medicineId,
        medicationName: medicine.medicationName,
        category: medicine.category,
        quantity: qty,
        unitTariff: medicine.unitTariff,
        estimatedCost: medicine.unitTariff * 100,
        supplier,
        createdBy: req.admin?.name || 'Administrator',
      });
      createdPOs.push(po);
    }

    return res.status(201).json({
      success: true,
      message: `${createdPOs.length} Purchase Orders created.`,
      data: createdPOs,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/purchase-orders
const getPurchaseOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
    const pos = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, total: pos.length, data: pos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/purchase-orders/:id
const getPurchaseOrderById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { poId: req.params.id.toUpperCase() };
    const po = await PurchaseOrder.findOne(filter).lean();
    if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
    return res.status(200).json({ success: true, data: po });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/pharmacy/purchase-orders/:id/status
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Received', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid PO status.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { poId: req.params.id.toUpperCase() };

    const po = await PurchaseOrder.findOne(filter);
    if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found.' });

    const prevStatus = po.status;
    po.status = status;
    if (status === 'Received') {
      po.alertStatus = 'Received';
      if (prevStatus !== 'Received') {
        const medicine = await Medicine.findOne({ medicineId: po.medicineId });
        if (medicine) {
          const previousStock = medicine.stockLevel;
          medicine.stockLevel += po.quantity;
          await medicine.save();

          await StockTransaction.create({
            medicine: medicine._id,
            medicineId: medicine.medicineId,
            type: 'add',
            quantity: po.quantity,
            previousStock,
            newStock: medicine.stockLevel,
            reason: `PO Received (${po.poId})`,
            supplier: po.supplier,
            performedBy: req.admin?.name || 'Administrator',
          });
        }
      }
    }

    await po.save();
    return res.status(200).json({ success: true, message: 'Purchase Order status updated.', data: po });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/pharmacy/purchase-orders/:id
const deletePurchaseOrder = async (req, res) => {
  try {
    const deleted = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
    return res.status(200).json({ success: true, message: 'Purchase Order deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/alerts/export/csv
const exportAlertsCsv = async (req, res) => {
  try {
    const data = await computeAlertRows();
    const headers = ['Code', 'Medication', 'Category', 'Current Stock', 'Safe Minimum', 'Reorder Qty', 'Estimated Cost (NGN)', 'Status'];
    const rows = data.map((d) =>
      [d.code, d.medicationName, d.category, d.currentStock, d.safeMinimum, d.reorderQuantity, d.estimatedCost, d.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="critical-low-stock-alerts.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/alerts/export/pdf
const exportAlertsPdf = async (req, res) => {
  try {
    const data = await computeAlertRows();
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - CRITICAL LOW STOCK THRESHOLD ALERTS',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...data.map((d) => `${d.code} | ${d.medicationName} | Stock: ${d.currentStock}/${d.safeMinimum} | Est Cost: NGN ${d.estimatedCost} | ${d.status}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="critical-low-stock-alerts.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCriticalLowStock,
  getAlertsSummary,
  createPurchaseOrder,
  createBatchPurchaseOrders,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  exportAlertsCsv,
  exportAlertsPdf,
};
