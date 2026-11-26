const PurchaseOrder = require('../models/PurchaseOrder');
const Medicine = require('../models/Medicine');
const StockTransaction = require('../models/StockTransaction');

// GET /api/pharmacy/vendor-orders/stats/summary
const getVendorOrdersSummary = async (req, res) => {
  try {
    const [orders, lowStockWarningCount] = await Promise.all([
      PurchaseOrder.find({ manufacturer: { $ne: '' } }).lean(),
      Medicine.countDocuments({ isActive: { $ne: false }, $expr: { $lt: ['$stockLevel', '$reorderAt'] } }),
    ]);

    const deliveredCount = orders.filter((o) => o.status === 'Delivered' || o.status === 'Received').length;
    const inTransitCount = orders.filter((o) => o.status === 'In Transit').length;
    const pendingApprovalCount = orders.filter((o) => o.status === 'Pending Approval' || o.status === 'Pending').length;
    const cancelledCount = orders.filter((o) => o.status === 'Cancelled').length;
    const totalInvoiceValue = orders.reduce((sum, o) => sum + (o.totalInvoice || o.estimatedCost || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalOrders: orders.length,
        deliveredCount,
        inTransitCount,
        pendingApprovalCount,
        cancelledCount,
        totalInvoiceValue,
        lowStockWarningCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/vendor-orders?search=&status=&manufacturer=
const getVendorOrders = async (req, res) => {
  try {
    const { search = '', status = '', manufacturer = '' } = req.query;
    const filter = { manufacturer: { $ne: '' } };

    if (status && status !== 'All') filter.status = status;
    if (manufacturer && manufacturer !== 'All') filter.manufacturer = new RegExp(manufacturer.trim(), 'i');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ poNumber: regex }, { manufacturer: regex }, { consignmentSummary: regex }];
    }

    const orders = await PurchaseOrder.find(filter).sort({ poDate: -1, createdAt: -1 }).lean();
    return res.status(200).json({ success: true, total: orders.length, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/vendor-orders/:id
const getVendorOrderById = async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ poNumber: req.params.id.toUpperCase() }, { poId: req.params.id.toUpperCase() }] };
    const order = await PurchaseOrder.findOne(filter).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Vendor order not found.' });
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/pharmacy/vendor-orders
const createVendorOrder = async (req, res) => {
  try {
    const { manufacturer, poDate, consignmentSummary, deliveryDate, totalInvoice, status = 'Pending Approval', items = [] } = req.body;
    if (!manufacturer || !consignmentSummary || totalInvoice === undefined || Number(totalInvoice) < 0) {
      return res.status(400).json({
        success: false,
        message: 'manufacturer, consignmentSummary, and totalInvoice (>= 0) are required.',
      });
    }

    const order = await PurchaseOrder.create({
      manufacturer,
      vendor: manufacturer,
      supplier: manufacturer,
      poDate: poDate ? new Date(poDate) : new Date(),
      consignmentSummary,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      totalInvoice: Number(totalInvoice),
      estimatedCost: Number(totalInvoice),
      status,
      items,
      createdBy: req.admin?.name || 'Administrator',
    });

    return res.status(201).json({ success: true, message: 'Vendor purchase order created.', data: order });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/pharmacy/vendor-orders/:id
const updateVendorOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Vendor order not found.' });
    return res.status(200).json({ success: true, message: 'Vendor order updated.', data: order });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/pharmacy/vendor-orders/:id/status
const updateVendorOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Delivered', 'In Transit', 'Pending Approval', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor order status.' });
    }

    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { $or: [{ poNumber: req.params.id.toUpperCase() }, { poId: req.params.id.toUpperCase() }] };

    const order = await PurchaseOrder.findOne(filter);
    if (!order) return res.status(404).json({ success: false, message: 'Vendor order not found.' });

    const prevStatus = order.status;
    order.status = status;

    if (status === 'Delivered' && prevStatus !== 'Delivered' && Array.isArray(order.items)) {
      for (const item of order.items) {
        if (!item.medicineId || !item.quantity) continue;
        const med = await Medicine.findOne({ medicineId: String(item.medicineId).toUpperCase() });
        if (med) {
          const previousStock = med.stockLevel;
          med.stockLevel += Number(item.quantity);
          await med.save();
          await StockTransaction.create({
            medicine: med._id,
            medicineId: med.medicineId,
            type: 'add',
            quantity: Number(item.quantity),
            previousStock,
            newStock: med.stockLevel,
            reason: `Vendor PO Delivered (${order.poNumber})`,
            supplier: order.manufacturer,
            performedBy: req.admin?.name || 'Administrator',
          });
        }
      }
    }

    await order.save();
    return res.status(200).json({ success: true, message: 'Vendor order status updated.', data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/pharmacy/vendor-orders/:id
const deleteVendorOrder = async (req, res) => {
  try {
    const deleted = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Vendor order not found.' });
    return res.status(200).json({ success: true, message: 'Vendor order deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/vendor-orders/export/csv
const exportVendorOrdersCsv = async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ manufacturer: { $ne: '' } }).sort({ poDate: -1 }).lean();
    const headers = ['PO Number', 'Manufacturer', 'PO Date', 'Consignment Summary', 'Delivery Date', 'Total Invoice (NGN)', 'Status'];
    const rows = orders.map((o) =>
      [o.poNumber, o.manufacturer, o.poDate, o.consignmentSummary, o.deliveryDate || '', o.totalInvoice, o.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-purchase-orders.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/pharmacy/vendor-orders/export/pdf
const exportVendorOrdersPdf = async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ manufacturer: { $ne: '' } }).sort({ poDate: -1 }).lean();
    const lines = [
      'NAIRA MULTI-SPECIALITY HOSPITAL - VENDOR PURCHASE ORDERS & RESTOCK LEDGER',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...orders.map((o) => `${o.poNumber} | ${o.manufacturer} | ${o.consignmentSummary} | NGN ${o.totalInvoice} | ${o.status}`),
    ];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-purchase-orders.pdf"');
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getVendorOrdersSummary,
  getVendorOrders,
  getVendorOrderById,
  createVendorOrder,
  updateVendorOrder,
  updateVendorOrderStatus,
  deleteVendorOrder,
  exportVendorOrdersCsv,
  exportVendorOrdersPdf,
};
