import express from "express";

import {
  createFaculty,
  getFaculty,
  getFacultyById,
} from "../controllers/facultyController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create faculty — admin only
router.post("/", protect, restrictTo("admin"), createFaculty);

// Faculty list / details — admin and staff (students cannot see faculty)
router.get("/", protect, restrictTo("admin", "staff"), getFaculty);

router.get("/:id", protect, restrictTo("admin", "staff"), getFacultyById);

export default router;
