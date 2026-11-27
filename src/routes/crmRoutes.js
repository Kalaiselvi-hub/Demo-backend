const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper to safely load or get models
const getModel = (name, relativePath) => {
  if (mongoose.models && mongoose.models[name]) {
    return mongoose.models[name];
  }
  try {
    return require(relativePath);
  } catch (err) {
    console.warn(`Could not load model ${name} from ${relativePath}:`, err.message);
    return null;
  }
};

const Patient = getModel('Patient', '../../backend/models/Patient');
const Doctor = getModel('Doctor', '../../backend/models/Doctor');
const Appointment = getModel('Appointment', '../../backend/models/Appointment');
const Staff = getModel('Staff', '../../backend/models/Staff');
const Invoice = getModel('Invoice', '../../backend/models/Invoice');

// ==========================================
// 1. APPOINTMENTS
// ==========================================

// GET /api/appointments
router.get('/appointments', async (req, res) => {
  try {
    const list = await Appointment.find().sort({ createdAt: -1, appointmentDate: -1 }).lean();
    res.status(200).json({
      success: true,
      count: list.length,
      appointments: list,
      data: list,
    });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: err.message });
  }
});

// POST /api/appointments/book and POST /api/appointments
const handleBookAppointment = async (req, res) => {
  try {
    const b = req.body || {};
    const patientName = b.patientName || b.patientFullName || b.name || 'Anonymous Patient';
    const phone = b.patientPhone || b.contactPhoneNumber || b.phone || '+234 800 000 0000';
    const age = Number(b.patientAge || b.age) || 30;
    const department = b.department || b.specialtyDepartment || 'General Medicine';
    const doctorName = b.doctor || b.consultingPhysician || 'Dr. Amina Bello';
    const appointmentDate = b.date || b.appointmentDate ? new Date(b.date || b.appointmentDate) : new Date();
    const timeSlot = b.time || b.timeSlot || '10:00 AM';
    const reason = b.reason || b.symptoms || 'General Consultation';
    const type = b.type || b.appointmentType || 'Consultation';
    const priority = b.priority || 'Normal';

    // Find or assign doctor reference
    let doctorDoc = null;
    if (b.doctorId && mongoose.Types.ObjectId.isValid(b.doctorId)) {
      doctorDoc = await Doctor.findById(b.doctorId);
    }
    if (!doctorDoc && doctorName) {
      doctorDoc = await Doctor.findOne({ name: new RegExp(doctorName.trim(), 'i') });
    }
    if (!doctorDoc) {
      doctorDoc = await Doctor.findOne();
    }
    if (!doctorDoc) {
      doctorDoc = await Doctor.create({
        name: doctorName,
        email: `doctor.${Date.now()}@nairahospital.ng`,
        phone: '+234 803 000 1122',
        specialization: department,
        department,
        qualification: 'MBBS, FWACS',
      });
    }

    const count = await Appointment.countDocuments();
    const aptId = `APT-${String(count + 1).padStart(4, '0')}`;

    const appointment = await Appointment.create({
      appointmentId: aptId,
      patientFullName: patientName,
      contactPhoneNumber: phone,
      patientAge: age,
      department,
      consultingPhysician: doctorDoc.name || doctorName,
      doctor: doctorDoc._id,
      appointmentDate,
      timeSlot,
      symptoms: reason,
      reason,
      appointmentType: type,
      priority,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment,
      data: appointment,
    });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ success: false, message: 'Failed to book appointment', error: err.message });
  }
};

router.post('/appointments/book', handleBookAppointment);
router.post('/appointments', handleBookAppointment);

// ==========================================
// 2. PATIENTS
// ==========================================

// GET /api/patients
router.get('/patients', async (req, res) => {
  try {
    const list = await Patient.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      count: list.length,
      patients: list,
      data: list,
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch patients', error: err.message });
  }
});

// POST /api/patients
router.post('/patients', async (req, res) => {
  try {
    const b = req.body || {};
    const name = b.name || b.fullName;
    const phone = b.phone || b.contactPhoneNumber;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Patient name and phone number are required.' });
    }

    const count = await Patient.countDocuments();
    const patId = `PAT-${1000 + count + 1}`;

    const patient = await Patient.create({
      patientId: patId,
      name: name.trim(),
      phone: phone.trim(),
      email: b.email ? b.email.trim().toLowerCase() : undefined,
      age: Number(b.age) || 30,
      gender: b.gender || 'Male',
      bloodGroup: b.bloodGroup || 'O+',
      department: b.department || 'General Medicine',
      diagnosis: b.diagnosis || '',
      room: b.room || 'General Ward 1, Bed 01',
      emergencyContact: b.emergencyContact || '',
      address: b.address || '',
      status: b.status || 'Admitted',
    });

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      patient,
      data: patient,
    });
  } catch (err) {
    console.error('Error registering patient:', err);
    res.status(500).json({ success: false, message: 'Failed to register patient', error: err.message });
  }
});

// ==========================================
// 3. DOCTORS
// ==========================================

// GET /api/doctors
router.get('/doctors', async (req, res) => {
  try {
    const list = await Doctor.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      count: list.length,
      doctors: list,
      data: list,
    });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch doctors', error: err.message });
  }
});

// POST /api/doctors
router.post('/doctors', async (req, res) => {
  try {
    const b = req.body || {};
    const name = b.name;
    const phone = b.phone;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Doctor name and phone number are required.' });
    }

    const count = await Doctor.countDocuments();
    const docId = `DOC-0${count + 1}`;
    const cleanName = name.toLowerCase().replace(/[^a-z]/g, '');
    const email = b.email || `dr.${cleanName || 'consultant'}.${Date.now().toString().slice(-4)}@nairahospital.ng`;

    const doctor = await Doctor.create({
      doctorId: docId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      specialization: b.specialization || b.department || 'Consultant',
      department: b.department || 'General Medicine',
      qualification: b.qualification || b.qualifications || 'MBBS, FWACS',
      experienceYears: parseInt(b.experience || b.experienceYears, 10) || 5,
      consultationFee: parseInt(b.consultationFee || b.fee, 10) || 20000,
      status: b.status || 'On Duty',
      rating: 5.0,
    });

    res.status(201).json({
      success: true,
      message: 'Doctor added successfully',
      doctor,
      data: doctor,
    });
  } catch (err) {
    console.error('Error creating doctor:', err);
    res.status(500).json({ success: false, message: 'Failed to add doctor', error: err.message });
  }
});

// ==========================================
// 4. STAFF
// ==========================================

// GET /api/staff
router.get('/staff', async (req, res) => {
  try {
    const list = await Staff.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      totalStaff: list.length,
      staff: list,
      data: list,
    });
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch staff', error: err.message });
  }
});

// POST /api/staff
router.post('/staff', async (req, res) => {
  try {
    const b = req.body || {};
    const fullName = (b.fullName || b.name || '').trim();
    const phone = (b.contactPhone || b.phone || '+234 800 000 0000').trim();

    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Staff name is required.' });
    }

    const count = await Staff.countDocuments();
    const staffId = `STF-0${count + 1}`;

    const staff = await Staff.create({
      staffId,
      fullName,
      role: b.role || 'Staff Nurse',
      department: b.department || 'Nursing Services',
      assignedShift: b.assignedShift || b.shift || 'Morning (07:00 - 15:00)',
      contactPhone: phone,
      status: b.status || 'Active',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Staff added successfully',
      staff,
      data: staff,
    });
  } catch (err) {
    console.error('Error creating staff:', err);
    res.status(500).json({ success: false, message: 'Failed to add staff', error: err.message });
  }
});

// ==========================================
// 5. BILLS / INVOICES
// ==========================================

// GET /api/bills and GET /api/invoices
const handleGetBills = async (req, res) => {
  try {
    const list = await Invoice.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      count: list.length,
      bills: list,
      invoices: list,
      data: list,
    });
  } catch (err) {
    console.error('Error fetching bills/invoices:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bills', error: err.message });
  }
};

router.get('/bills', handleGetBills);
router.get('/invoices', handleGetBills);

// POST /api/bills and POST /api/invoices
const handleCreateBill = async (req, res) => {
  try {
    const b = req.body || {};
    const patientName = b.patientName || 'Walk-in Patient';
    const rawItems = Array.isArray(b.items) && b.items.length > 0 ? b.items : null;

    let subtotal = 0;
    let items = [];

    if (rawItems) {
      items = rawItems.map((item) => {
        const qty = Math.max(1, parseInt(item.qty || item.quantity, 10) || 1);
        const rate = Math.max(0, parseInt(item.rate || item.unitPrice, 10) || 0);
        const total = item.total !== undefined ? item.total : qty * rate;
        subtotal += total;
        return {
          description: item.name || item.description || 'Medical Service',
          quantity: qty,
          unitPrice: rate,
          total,
        };
      });
    } else {
      const amt = Number(b.amount || b.totalAmount) || 25000;
      subtotal = amt;
      items = [
        {
          description: 'Specialist Medical Consultation',
          quantity: 1,
          unitPrice: amt,
          total: amt,
        },
      ];
    }

    const tax = b.tax !== undefined ? Number(b.tax) : Math.round(subtotal * 0.075);
    const totalAmount = b.totalAmount !== undefined ? Number(b.totalAmount) : subtotal + tax;
    const paidAmount = b.isPaidDirectly || b.paymentStatus === 'Paid' ? totalAmount : Number(b.paidAmount || b.paid) || 0;
    const paymentStatus = paidAmount >= totalAmount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending';

    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-2024-0${840 + count + 1}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      patientName,
      items,
      subtotal,
      tax,
      totalAmount,
      paidAmount,
      paymentStatus,
      paymentMethod: b.method || b.paymentMethod || 'POS Card Payment',
      notes: b.notes || 'NAIRA Specialist Hospital & Medical Centre Invoice',
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill: invoice,
      invoice,
      data: invoice,
    });
  } catch (err) {
    console.error('Error creating bill/invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to create bill', error: err.message });
  }
};

router.post('/bills', handleCreateBill);
router.post('/invoices', handleCreateBill);

// ==========================================
// 6. DASHBOARD OVERVIEW COUNTS
// ==========================================

// GET /api/dashboard/overview
router.get('/dashboard/overview', async (req, res) => {
  try {
    const [totalPatients, totalDoctors, totalAppointments, totalBills, appointmentsPending, appointmentsDone] =
      await Promise.all([
        Patient.countDocuments(),
        Doctor.countDocuments(),
        Appointment.countDocuments(),
        Invoice.countDocuments(),
        Appointment.countDocuments({ status: 'Pending' }),
        Appointment.countDocuments({ status: 'Completed' }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalPatients,
          totalDoctors,
          totalAppointments,
          totalBills,
          appointmentsPending,
          appointmentsDone,
        },
        counts: {
          patients: totalPatients,
          doctors: totalDoctors,
          appointments: totalAppointments,
          bills: totalBills,
        },
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard overview:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch overview counts', error: err.message });
  }
});

module.exports = router;
