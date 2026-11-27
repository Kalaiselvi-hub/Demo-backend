const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getOverview } = require("../controllers/overviewController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getOverview);

module.exports = router;
