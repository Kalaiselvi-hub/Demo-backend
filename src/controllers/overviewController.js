const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");

// GET /api/overview
const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [totalPatients, totalDoctors, totalAppointments, totalBills, todaysAppointments, revenueAgg] =
      await Promise.all([
        Patient.countDocuments(),
        Doctor.countDocuments(),
        Appointment.countDocuments(),
        Bill.countDocuments(),
        Appointment.countDocuments({
          appointmentDate: { $gte: startOfToday, $lte: endOfToday },
        }),
        Bill.aggregate([
          { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, totalCollected: { $sum: "$paidAmount" } } },
        ]),
      ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalCollected = revenueAgg[0]?.totalCollected || 0;

    return res.status(200).json({
      success: true,
      totalPatients,
      totalDoctors,
      totalAppointments,
      totalBills,
      todaysAppointments,
      totalRevenue,
      totalCollected,
      data: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalBills,
        todaysAppointments,
        totalRevenue,
        totalCollected,
        kpis: {
          totalPatients,
          totalDoctors,
          totalAppointments,
          totalBills,
          todaysAppointments,
          totalRevenue,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load overview metrics.",
      error: error.message,
    });
  }
};

module.exports = { getOverview };
