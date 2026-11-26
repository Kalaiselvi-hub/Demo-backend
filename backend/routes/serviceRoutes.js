const express = require('express');
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServicesByCategory,
} = require('../controllers/serviceController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/by-category', getServicesByCategory);
router.get('/stats', getServicesByCategory);
router.get('/catalog', getServices);
router.get('/', getServices);
router.post('/', authorizePrivileges('Clinical Administration', 'Super Administrator'), createService);
router.get('/:id', getServiceById);
router.put('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), updateService);
router.delete('/:id', authorizePrivileges('Clinical Administration', 'Super Administrator'), deleteService);

module.exports = router;
