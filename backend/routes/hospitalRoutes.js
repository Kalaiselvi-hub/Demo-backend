const express = require('express');
const { getHospitalPrices } = require('../controllers/hospitalController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/prices', getHospitalPrices);

module.exports = router;
