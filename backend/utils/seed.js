require('dotenv').config();
const connectDB = require('../config/db');
const Privilege = require('../models/Privilege');
const Admin = require('../models/Admin');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Facility = require('../models/Facility');
const Bed = require('../models/Bed');
const Admission = require('../models/Admission');
const HospitalPrice = require('../models/HospitalPrice');
const Department = require('../models/Department');
const Ambulance = require('../models/Ambulance');
const Specialization = require('../models/Specialization');

const seedData = async () => {
  try {
    await connectDB();

    // Privileges
    const privilegeDefs = [
      { name: 'Super Administrator', description: 'Full system and privilege management access' },
      { name: 'Full EMR Access', description: 'Access to electronic medical records, patients, and appointments' },
      { name: 'Billing & Revenue Sign-off', description: 'Manage invoices, payments, and revenue reports' },
      { name: 'Pharmacy Procurement Audit', description: 'Audit pharmacy inventory and procurement' },
      { name: 'Clinical Administration', description: 'Manage doctors, departments, and clinical operations' },
    ];
    const privileges = [];
    for (const def of privilegeDefs) {
      let priv = await Privilege.findOne({ name: def.name });
      if (!priv) priv = await Privilege.create(def);
      privileges.push(priv);
    }

    // Admin
    let admin = await Admin.findOne({ email: 'chief.doctor@nairahospital.com' });
    if (!admin) {
      admin = await Admin.create({
        name: 'Dr. Arjun Nair',
        email: 'chief.doctor@nairahospital.com',
        password: 'Password@123',
        jobTitle: 'Chief Medical Officer',
        department: 'Clinical Administration',
        directLine: '+91-44-2815-9000',
        hospitalCentre: 'NAIRA Multi-Speciality Hospital - Chennai',
        location: 'Chennai, Tamil Nadu',
        role: 'Super Administrator',
        privileges: privileges.map((p) => p._id),
      });
    }

    // Doctor
    let doctor = await Doctor.findOne({ email: 'dr.meera@nairahospital.com' });
    if (!doctor) {
      doctor = await Doctor.create({
        name: 'Dr. Meera Krishnan',
        email: 'dr.meera@nairahospital.com',
        phone: '+91-98400-11223',
        specialization: 'Cardiology',
        department: 'Cardiology & Heart Institute',
        qualification: 'MBBS, MD, DM (Cardiology)',
        qualifications: 'MBBS, MD, DM (Cardiology)',
        experienceYears: 12,
        consultationFee: 800,
        status: 'On Duty',
        availability: 'Mon-Fri 9AM-5PM',
        rating: 4.9,
        createdBy: admin._id,
      });
    }

    // Patient
    let patient = await Patient.findOne({ email: 'sample.patient@example.com' });
    if (!patient) {
      patient = await Patient.create({
        name: 'Sample Patient One',
        email: 'sample.patient@example.com',
        phone: '+91-90000-00001',
        age: 34,
        gender: 'Female',
        bloodGroup: 'O+',
        address: '123 Sample Street, Chennai',
        department: 'Cardiology & Heart Institute',
        assignedDoctor: doctor._id,
        status: 'Outpatient',
        createdBy: admin._id,
      });
    }

    // Appointment
    const existingApt = await Appointment.findOne({ patient: patient._id, doctor: doctor._id });
    let appointment = existingApt;
    if (!appointment) {
      appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeSlot: '10:30 AM',
        department: 'Cardiology & Heart Institute',
        reason: 'Routine Cardiac Checkup',
        status: 'Pending',
        createdBy: admin._id,
      });
    }

    // Invoice
    const existingInv = await Invoice.findOne({ patient: patient._id });
    if (!existingInv) {
      await Invoice.create({
        patient: patient._id,
        doctor: doctor._id,
        appointment: appointment._id,
        items: [
          { description: 'Cardiology Consultation', quantity: 1, unitPrice: 800, total: 800 },
          { description: 'ECG Screening', quantity: 1, unitPrice: 400, total: 400 },
        ],
        subtotal: 1200,
        tax: 0,
        discount: 0,
        totalAmount: 1200,
        paymentStatus: 'Paid',
        paymentMethod: 'Card',
        createdBy: admin._id,
      });
    }

    // Facilities & Beds
    const facilityDefs = [
      { name: 'General Wards', department: 'General Medicine', totalBeds: 80, occupiedCount: 62 },
      { name: 'ICU Critical Care', department: 'Critical Care', totalBeds: 12, occupiedCount: 8 },
      { name: 'Maternity Suites', department: 'Obstetrics & Gynecology', totalBeds: 20, occupiedCount: 14 },
    ];
    for (const fDef of facilityDefs) {
      let fac = await Facility.findOne({ name: fDef.name });
      if (!fac) {
        fac = await Facility.create({ name: fDef.name, department: fDef.department, totalBeds: fDef.totalBeds });
        const bedsToCreate = [];
        for (let i = 1; i <= fDef.totalBeds; i++) {
          bedsToCreate.push({
            bedNumber: `${fDef.name.slice(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
            facility: fac._id,
            status: i <= fDef.occupiedCount ? 'Occupied' : 'Available',
          });
        }
        await Bed.insertMany(bedsToCreate);
      }
    }

    // ICU bed flags
    const icuFac = await Facility.findOne({ name: 'ICU Critical Care' });
    if (icuFac) {
      const icuBeds = await Bed.find({ facility: icuFac._id }).sort({ bedNumber: 1 });
      for (let i = 0; i < icuBeds.length; i++) {
        icuBeds[i].ventilatorConnected = i < 5;
        icuBeds[i].isEmergencyReserve = i === icuBeds.length - 1;
        await icuBeds[i].save();
      }
    }

    // Hospital Prices
    const existingPrice = await HospitalPrice.findOne();
    if (!existingPrice) {
      await HospitalPrice.insertMany([
        { serviceName: 'General Consultation', category: 'Consultation', department: 'General Medicine', price: 15000, currency: 'NGN' },
        { serviceName: 'Cardiology Specialist Consultation', category: 'Consultation', department: 'Cardiology & Heart Institute', price: 35000, currency: 'NGN' },
        { serviceName: 'Complete Blood Count (CBC)', category: 'Laboratory', department: 'Pathology', price: 8500, currency: 'NGN' },
        { serviceName: 'ICU Daily Bed Charge', category: 'Ward', department: 'Critical Care', price: 120000, currency: 'NGN' },
      ]);
    }

    // Admission
    const existingAdm = await Admission.findOne();
    if (!existingAdm) {
      const genWard = await Facility.findOne({ name: 'General Wards' });
      if (genWard) {
        await Admission.create({
          patient: patient._id,
          doctor: doctor._id,
          facility: genWard._id,
          admissionDate: new Date(),
          status: 'Admitted',
          diagnosis: 'Observation',
          createdBy: admin._id,
        });
      }
    }

    // Departments (operational + clinical)
    const departmentDefs = [
      { name: 'Intensive Care Unit (ICU)', totalUnits: 12, occupiedUnits: 8, status: 'Operational' },
      { name: 'Operation Theaters (4 Suites)', totalUnits: 4, occupiedUnits: 2, status: 'Operational' },
      { name: 'Automated Blood Bank', totalUnits: 100, occupiedUnits: 24, status: 'Available' },
      { name: 'Diagnostic Imaging Center', totalUnits: 6, occupiedUnits: 4, status: 'Busy' },
      { name: 'Emergency & Triage Bay', totalUnits: 10, occupiedUnits: 4, status: 'Operational', triageLevel: 'Green Response', averageWaitTimeMinutes: 12 },
      { name: 'Mobile Ambulance Fleet', totalUnits: 6, occupiedUnits: 4, status: 'Operational' },
      { name: 'Cardiology & Heart Institute', totalUnits: 12, occupiedUnits: 8, status: 'Operational' },
      { name: 'Neurology', totalUnits: 10, occupiedUnits: 6, status: 'Operational' },
      { name: 'Orthopedics & Sports', totalUnits: 8, occupiedUnits: 4, status: 'Operational' },
      { name: 'Pediatrics', totalUnits: 10, occupiedUnits: 5, status: 'Operational' },
      { name: 'Oncology', totalUnits: 6, occupiedUnits: 3, status: 'Operational' },
      { name: 'Surgery', totalUnits: 8, occupiedUnits: 4, status: 'Operational' },
      { name: 'General Medicine', totalUnits: 20, occupiedUnits: 10, status: 'Operational' },
    ];
    for (const dDef of departmentDefs) {
      await Department.findOneAndUpdate({ name: dDef.name }, dDef, { upsert: true, new: true });
    }

    // Ambulances
    const ambulanceDefs = [
      { vehicleNumber: 'AMB-01', status: 'Active', driverName: 'Ramesh Kumar', driverOnDuty: true },
      { vehicleNumber: 'AMB-02', status: 'Active', driverName: 'Suresh Babu', driverOnDuty: true },
      { vehicleNumber: 'AMB-03', status: 'Active', driverName: 'Vikram Singh', driverOnDuty: true },
      { vehicleNumber: 'AMB-04', status: 'Active', driverName: 'Anil Sharma', driverOnDuty: true },
      { vehicleNumber: 'AMB-05', status: 'Available', driverName: 'Karthik Raj', driverOnDuty: true },
      { vehicleNumber: 'AMB-06', status: 'Available', driverName: 'Deepak Nair', driverOnDuty: false },
    ];
    for (const aDef of ambulanceDefs) {
      await Ambulance.findOneAndUpdate({ vehicleNumber: aDef.vehicleNumber }, aDef, { upsert: true, new: true });
    }

    // Specializations
    const specializationDefs = [
      { title: 'Senior Consultant Cardiologist', department: 'Cardiology & Heart Institute' },
      { title: 'Interventional Cardiologist', department: 'Cardiology & Heart Institute' },
      { title: 'Consultant Neurologist', department: 'Neurology' },
      { title: 'Neurointerventionist', department: 'Neurology' },
      { title: 'Orthopedic Surgeon', department: 'Orthopedics & Sports' },
      { title: 'Sports Medicine Specialist', department: 'Orthopedics & Sports' },
      { title: 'Pediatrician', department: 'Pediatrics' },
      { title: 'Neonatologist', department: 'Pediatrics' },
      { title: 'Oncologist', department: 'Oncology' },
      { title: 'Radiation Oncologist', department: 'Oncology' },
      { title: 'General Surgeon', department: 'Surgery' },
      { title: 'Laparoscopic Surgeon', department: 'Surgery' },
      { title: 'General Medicine Physician', department: 'General Medicine' },
      { title: 'Internal Medicine Specialist', department: 'General Medicine' },
      { title: 'Emergency Medicine Physician', department: 'Emergency & Triage Bay' },
      { title: 'Obstetrician & Gynecologist', department: 'Pediatrics' },
    ];
    for (const spec of specializationDefs) {
      await Specialization.findOneAndUpdate({ title: spec.title }, spec, { upsert: true, new: true });
    }

    console.log('Seed data created successfully.');
    console.log('Chief Doctor Login -> Email: chief.doctor@nairahospital.com | Password: Password@123');
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
};

seedData();
