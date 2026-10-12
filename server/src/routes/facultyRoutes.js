import express from "express";

import {
  createFaculty,
  getFaculty,
  getFacultyById,
} from "../controllers/facultyController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Add a new faculty member — dept. in-charge and above
router.post("/", protect, requirePermission("addFaculty"), createFaculty);

// Faculty list / details — dept. in-charge and above
router.get("/", protect, requirePermission("viewFacultyList"), getFaculty);

router.get(
  "/:id",
  protect,
  requirePermission("viewFacultyList"),
  getFacultyById,
);

export default router;
