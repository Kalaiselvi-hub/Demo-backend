const express = require('express');
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  toggleRolePermission,
  deleteRole,
} = require('../controllers/roleController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getRoles);
router.get('/:id', getRoleById);
router.post('/', authorizePrivileges('Super Administrator'), createRole);
router.put('/:id', authorizePrivileges('Super Administrator'), updateRole);
router.patch('/:id/permissions', authorizePrivileges('Super Administrator'), toggleRolePermission);
router.delete('/:id', authorizePrivileges('Super Administrator'), deleteRole);

module.exports = router;
