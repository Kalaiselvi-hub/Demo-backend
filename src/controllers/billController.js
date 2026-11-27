const Bill = require("../models/Bill");
const { buildIdOrCodeFilter } = require("../utils/findByIdOrCode");

// POST /api/bills
const createBill = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.patientName || !String(body.patientName).trim()) {
      return res.status(400).json({ success: false, message: "Patient name is required." });
    }

    const normalizedItems = Array.isArray(body.items)
      ? body.items.map((item) => {
          const quantity = Number(item.quantity ?? item.qty ?? 1);
          const unitPrice = Number(item.unitPrice ?? item.rate ?? 0);
          return {
            description: item.description || item.name || "Medical Service",
            quantity,
            unitPrice,
            total: Number(item.total ?? quantity * unitPrice),
          };
        })
      : [];

    const computedSubtotal = normalizedItems.reduce((sum, i) => sum + i.total, 0);
    const subtotal = body.subtotal !== undefined ? Number(body.subtotal) : computedSubtotal;
    const tax = body.tax !== undefined ? Number(body.tax) : 0;
    const discount = body.discount !== undefined ? Number(body.discount) : 0;
    const totalAmount =
      body.totalAmount !== undefined
        ? Number(body.totalAmount)
        : body.amount !== undefined
        ? Number(body.amount)
        : Math.max(0, subtotal + tax - discount);

    const paidAmount =
      body.paidAmount !== undefined
        ? Number(body.paidAmount)
        : body.isPaidDirectly
        ? totalAmount
        : 0;

    const paymentStatus =
      body.paymentStatus ||
      (paidAmount >= totalAmount && totalAmount > 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Pending");

    const bill = await Bill.create({
      invoiceNumber: body.invoiceNumber || body.invoiceNo,
      patient: body.patientRef,
      patientId: body.patientId || "",
      patientName: String(body.patientName).trim(),
      items: normalizedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      paidAmount,
      paymentStatus,
      paymentMethod: body.paymentMethod || body.method || "Card",
      issuedAt: body.issuedAt || Date.now(),
      createdBy: req.user?.id || req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Bill saved to database.",
      bill,
      invoice: bill,
      data: bill,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create bill.",
      error: error.message,
    });
  }
};

// GET /api/bills
const getBills = async (req, res) => {
  try {
    const { status = "", search = "" } = req.query;
    const query = {};

    if (status && status !== "All") query.paymentStatus = status;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ invoiceNumber: regex }, { patientName: regex }, { patientId: regex }];
    }

    const bills = await Bill.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: bills.length,
      total: bills.length,
      bills,
      invoices: bills,
      data: bills,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bills.",
      error: error.message,
    });
  }
};

// GET /api/bills/:id
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne(buildIdOrCodeFilter(req.params.id, "invoiceNumber")).lean();
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found." });
    }
    return res.status(200).json({
      success: true,
      bill,
      invoice: bill,
      data: bill,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bill.",
      error: error.message,
    });
  }
};

module.exports = {
  createBill,
  getBills,
  getBillById,
};
