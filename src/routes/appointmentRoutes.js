const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
} = require("../controllers/appointmentController");

const router = express.Router();

router.use(authMiddleware);

router.post("/book", bookAppointment);
router.get("/", getAppointments);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

module.exports = router;
