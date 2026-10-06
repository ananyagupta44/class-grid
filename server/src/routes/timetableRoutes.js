import express from "express";

import {
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  createComboTimetableEntry,
} from "../controllers/timetableController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

/*
 * student → view only
 * staff   → view + edit timetable entries
 * admin   → view + edit timetable entries
 */

// View timetable — any logged-in user
router.get("/", protect, getTimetable);

// Add class — admin + staff
router.post("/", protect, restrictTo("admin", "staff"), createTimetableEntry);

// Add combo class — admin + staff
router.post(
  "/combo",
  protect,
  restrictTo("admin", "staff"),
  createComboTimetableEntry,
);

// Edit / move class — admin + staff
router.put(
  "/:id",
  protect,
  restrictTo("admin", "staff"),
  updateTimetableEntry,
);

// Delete class — admin + staff
router.delete(
  "/:id",
  protect,
  restrictTo("admin", "staff"),
  deleteTimetableEntry,
);

export default router;
