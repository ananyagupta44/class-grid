import express from "express";

import {
  createSubject,
  getSubjects,
  getSubjectById,
} from "../controllers/subjectController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create subject - Admin only
router.post("/", protect, restrictTo("admin"), createSubject);

// Get all subjects
router.get("/", getSubjects);

// Get single subject
router.get("/:id", getSubjectById);

export default router;
