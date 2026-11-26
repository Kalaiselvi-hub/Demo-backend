const Bed = require('../models/Bed');
const Facility = require('../models/Facility');
const Department = require('../models/Department');
const Ambulance = require('../models/Ambulance');

const computeIcuStatus = async () => {
  const icuFacility = await Facility.findOne({ name: /ICU/i }).lean();
  if (!icuFacility) {
    return {
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      ventilatorsConnected: 0,
      emergencyReserveBeds: 0,
      occupancyPercentage: 0,
    };
  }

  const [agg] = await Bed.aggregate([
    { $match: { facility: icuFacility._id } },
    {
      $group: {
        _id: null,
        totalBeds: { $sum: 1 },
        occupiedBeds: { $sum: { $cond: [{ $eq: ['$status', 'Occupied'] }, 1, 0] } },
        availableBeds: { $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] } },
        ventilatorsConnected: { $sum: { $cond: ['$ventilatorConnected', 1, 0] } },
        emergencyReserveBeds: { $sum: { $cond: ['$isEmergencyReserve', 1, 0] } },
      },
    },
  ]);

  const totalBeds = agg?.totalBeds || icuFacility.totalBeds || 0;
  const occupiedBeds = agg?.occupiedBeds || 0;
  const availableBeds = agg?.availableBeds ?? Math.max(0, totalBeds - occupiedBeds);
  const occupancyPercentage = totalBeds === 0 ? 0 : Number(((occupiedBeds / totalBeds) * 100).toFixed(2));

  return {
    totalBeds,
    occupiedBeds,
    availableBeds,
    ventilatorsConnected: agg?.ventilatorsConnected || 0,
    emergencyReserveBeds: agg?.emergencyReserveBeds || 0,
    occupancyPercentage,
  };
};

const computeEmergencyTriage = async () => {
  const triageDept = await Department.findOne({ name: /Emergency/i }).lean();
  if (!triageDept) {
    return {
      triageLevel: 'Green Response',
      status: 'Green Response',
      triageBedsOccupied: 0,
      triageBedsTotal: 0,
      averageWaitTime: '0 mins',
    };
  }

  return {
    triageLevel: triageDept.triageLevel || 'Green Response',
    status: triageDept.triageLevel || 'Green Response',
    triageBedsOccupied: triageDept.occupiedUnits || 0,
    triageBedsTotal: triageDept.totalUnits || 0,
    averageWaitTime: `${triageDept.averageWaitTimeMinutes || 0} mins`,
  };
};

const computeAmbulanceFleet = async () => {
  const [agg] = await Ambulance.aggregate([
    {
      $group: {
        _id: null,
        totalAmbulances: { $sum: 1 },
        activeAmbulances: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        availableAmbulances: { $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] } },
        onDutyDrivers: { $sum: { $cond: ['$driverOnDuty', 1, 0] } },
      },
    },
  ]);

  return {
    totalAmbulances: agg?.totalAmbulances || 0,
    activeAmbulances: agg?.activeAmbulances || 0,
    availableAmbulances: agg?.availableAmbulances || 0,
    onDutyDrivers: agg?.onDutyDrivers || 0,
  };
};

const computeDepartmentsLive = async () => {
  const departments = await Department.find().sort({ name: 1 }).lean();
  const formatted = departments.map((dept) => {
    const available = Math.max(0, (dept.totalUnits || 0) - (dept.occupiedUnits || 0));
    return {
      _id: dept._id,
      name: dept.name,
      totalUnits: dept.totalUnits,
      occupied: dept.occupiedUnits,
      available,
      status: dept.status,
      liveStatusBadge: dept.status,
    };
  });

  return { departments: formatted };
};

// GET /api/operational/icu-status
const getIcuStatus = async (req, res) => {
  try {
    const data = await computeIcuStatus();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/operational/emergency-triage
const getEmergencyTriage = async (req, res) => {
  try {
    const data = await computeEmergencyTriage();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/operational/ambulance-fleet
const getAmbulanceFleet = async (req, res) => {
  try {
    const data = await computeAmbulanceFleet();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/operational/departments-live
const getDepartmentsLive = async (req, res) => {
  try {
    const data = await computeDepartmentsLive();
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/operational/live-status
const getLiveStatus = async (req, res) => {
  try {
    const [icuStatus, emergencyTriage, ambulanceFleet, departmentsLive] = await Promise.all([
      computeIcuStatus(),
      computeEmergencyTriage(),
      computeAmbulanceFleet(),
      computeDepartmentsLive(),
    ]);

    return res.status(200).json({
      success: true,
      liveStatus: {
        icuStatus,
        emergencyTriage,
        ambulanceFleet,
        departments: departmentsLive.departments,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getIcuStatus,
  getEmergencyTriage,
  getAmbulanceFleet,
  getDepartmentsLive,
  getLiveStatus,
};
