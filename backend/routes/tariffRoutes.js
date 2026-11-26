const express = require('express');
const {
  getTariffs,
  getTariffCategories,
  getTariffById,
  createTariff,
  updateTariff,
  deleteTariff,
} = require('../controllers/tariffController');
const { protect, authorizePrivileges } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/categories', getTariffCategories);
router.get('/', getTariffs);
router.get('/:id', getTariffById);
router.post('/', authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'), createTariff);
router.put('/:id', authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'), updateTariff);
router.delete('/:id', authorizePrivileges('Billing & Revenue Sign-off', 'Clinical Administration', 'Super Administrator'), deleteTariff);

module.exports = router;
