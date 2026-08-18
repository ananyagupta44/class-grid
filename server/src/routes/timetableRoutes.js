import express from "express";

import {
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
} from "../controllers/timetableController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();


// Get timetable
router.get(
  "/",
  protect,
  getTimetable
);


// Add class
router.post(
  "/",
  protect,
  restrictTo("admin"),
  createTimetableEntry
);


// Edit / move class
router.put(
  "/:id",
  protect,
  restrictTo("admin"),
  updateTimetableEntry
);


// Delete class
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  deleteTimetableEntry
);


export default router;