const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

// GET /api/departments?search=
const getDepartments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { code: regex }, { headOfDept: regex }];
    }

    const departments = await Department.find(filter).sort({ name: 1 }).lean();

    // Enrich each department with live doctor count from Doctors collection
    const enriched = await Promise.all(
      departments.map(async (dept) => {
        const doctorsCount = await Doctor.countDocuments({
          department: new RegExp(`^${dept.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
        const totalBeds = dept.totalBeds || dept.beds || dept.totalUnits || 0;
        const occupiedBeds = dept.occupiedBeds || dept.occupiedUnits || 0;
        const availableBeds = Math.max(0, totalBeds - occupiedBeds);

        return {
          _id: dept._id,
          code: dept.code || dept.name.slice(0, 4).toUpperCase(),
          name: dept.name,
          departmentName: dept.name,
          headOfDept: dept.headOfDept || '',
          headOfDepartment: dept.headOfDept || '',
          headDoctorId: dept.headDoctorId || '',
          description: dept.description || '',
          doctorsCount,
          beds: totalBeds,
          totalBeds,
          occupiedBeds,
          availableBeds,
          activeCases: dept.activeCases || occupiedBeds,
          totalUnits: dept.totalUnits || totalBeds,
          occupiedUnits: dept.occupiedUnits || occupiedBeds,
          status: dept.operationalStatus || 'Operational 24x7',
          operationalStatus: dept.operationalStatus || 'Operational 24x7',
          triageLevel: dept.triageLevel,
          averageWaitTimeMinutes: dept.averageWaitTimeMinutes,
        };
      })
    );

    return res.status(200).json({
      success: true,
      totalDepartments: enriched.length,
      count: enriched.length,
      data: enriched,
      departments: enriched,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch departments.', error: error.message });
  }
};

// GET /api/departments/stats
const getDepartmentStats = async (req, res) => {
  try {
    const [departments, totalDoctors, doctorAgg, patientAgg] = await Promise.all([
      Department.find().sort({ name: 1 }).lean(),
      Doctor.countDocuments(),
      Doctor.aggregate([
        { $group: { _id: { $ifNull: ['$department', 'General Medicine'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Patient.aggregate([
        { $group: { _id: { $ifNull: ['$department', 'General Medicine'] }, patients: { $sum: 1 } } },
        { $sort: { patients: -1 } },
      ]),
    ]);

    const doctorsPerDepartment = doctorAgg.map((item) => ({
      name: item._id,
      count: item.count,
      percentage: totalDoctors === 0 ? 0 : Number(((item.count / totalDoctors) * 100).toFixed(2)),
    }));

    const patientsPerDepartment = patientAgg.map((item) => ({
      name: item._id,
      patients: item.patients,
    }));

    // Merge department active cases from Department model for the bar chart
    const deptCaseMap = new Map(departments.map((d) => [d.name, d.activeCases || 0]));
    const patientsPerDeptWithCases = departments
      .filter((d) => d.beds > 0 || d.activeCases > 0)
      .map((d) => ({
        name: d.name,
        inpatients: d.occupiedUnits || 0,
        outpatients: Math.max(0, (d.activeCases || 0) - (d.occupiedUnits || 0)),
        patients: d.activeCases || 0,
      }));

    return res.status(200).json({
      success: true,
      data: {
        totalDoctors,
        doctorsPerDepartment,
        patientsPerDepartment,
        patientsPerDeptWithCases,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch department stats.', error: error.message });
  }
};

// GET /api/departments/:id
const getDepartmentById = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id).lean();
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found.' });

    const doctorsCount = await Doctor.countDocuments({
      department: new RegExp(`^${dept.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    const doctors = await Doctor.find({
      department: new RegExp(`^${dept.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        ...dept,
        doctorsCount,
        beds: dept.beds || dept.totalUnits || 0,
        activeCases: dept.activeCases || dept.occupiedUnits || 0,
        doctors,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/departments
const createDepartment = async (req, res) => {
  try {
    const { name, headOfDept, beds, activeCases, description, status, totalUnits, occupiedUnits } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Department name is required.' });

    const existing = await Department.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) return res.status(400).json({ success: false, message: 'A department with this name already exists.' });

    const dept = await Department.create({
      name,
      headOfDept: headOfDept || '',
      beds: beds || totalUnits || 0,
      activeCases: activeCases || occupiedUnits || 0,
      description: description || '',
      operationalStatus: status || 'Active 24/7',
      totalUnits: totalUnits || beds || 0,
      occupiedUnits: occupiedUnits || activeCases || 0,
    });

    return res.status(201).json({ success: true, message: 'Department created successfully.', data: dept });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/departments/:id
const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found.' });
    return res.status(200).json({ success: true, message: 'Department updated.', data: dept });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/departments/:id
const deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found.' });
    return res.status(200).json({ success: true, message: 'Department deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDepartments, getDepartmentStats, getDepartmentById, createDepartment, updateDepartment, deleteDepartment };
