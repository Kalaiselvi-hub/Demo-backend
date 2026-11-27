const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createBill,
  getBills,
  getBillById,
} = require("../controllers/billController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createBill);
router.get("/", getBills);
router.get("/:id", getBillById);

module.exports = router;
