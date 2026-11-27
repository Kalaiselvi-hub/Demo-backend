const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createStaff);
router.get("/", getStaff);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);

module.exports = router;
