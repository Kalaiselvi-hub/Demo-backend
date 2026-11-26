require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const operationalRoutes = require('./routes/operationalRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const clinicalRecordRoutes = require('./routes/clinicalRecordRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const tariffRoutes = require('./routes/tariffRoutes');
const staffRoutes = require('./routes/staffRoutes');
const roleRoutes = require('./routes/roleRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const outstandingRoutes = require('./routes/outstandingRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const reportRoutes = require('./routes/reportRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
connectDB();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'NAIRA Hospital CRM API is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/billing', invoiceRoutes);
app.use('/api/bills', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/operational', operationalRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/clinical-records', clinicalRecordRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/tariffs', tariffRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/outstanding', outstandingRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NAIRA Hospital CRM Backend running on http://localhost:${PORT}`);
});
