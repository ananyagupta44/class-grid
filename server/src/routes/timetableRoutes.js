import express from "express";

import {
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  createComboTimetableEntry,
} from "../controllers/timetableController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

/*
 * View   : any logged-in user
 * Change : admin (TT team) and super admin
 */

router.get("/", protect, getTimetable);

router.post(
  "/",
  protect,
  requirePermission("editTimetable"),
  createTimetableEntry,
);

router.post(
  "/combo",
  protect,
  requirePermission("editTimetable"),
  createComboTimetableEntry,
);

router.put(
  "/:id",
  protect,
  requirePermission("editTimetable"),
  updateTimetableEntry,
);

router.delete(
  "/:id",
  protect,
  requirePermission("editTimetable"),
  deleteTimetableEntry,
);

export default router;
