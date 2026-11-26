const express = require('express');
const { getDepartments, getDepartmentStats, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/stats', authorizePrivileges('Full EMR Access', 'Clinical Administration', 'Super Administrator'), getDepartmentStats);
router.get('/', getDepartments);
router.post('/', authorizePrivileges('Clinical Administration', 'Super Administrator'), createDepartment);
router.get('/:id', getDepartmentById);
router.put('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateDepartment);
router.delete('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), deleteDepartment);

module.exports = router;
