import express from "express";

import {
  createSubject,
  getSubjects,
  getSubjectById,
} from "../controllers/subjectController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create subject — admin only
router.post("/", protect, restrictTo("admin"), createSubject);

// Get all subjects — any logged-in user
router.get("/", protect, getSubjects);

// Get single subject — any logged-in user
router.get("/:id", protect, getSubjectById);

export default router;
