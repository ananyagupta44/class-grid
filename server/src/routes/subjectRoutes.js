import express from "express";

import {
  createSubject,
  getSubjects,
  getSubjectById,
} from "../controllers/subjectController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create a subject — super admin only
router.post("/", protect, requirePermission("addSubject"), createSubject);

// View subjects — any logged-in user
router.get("/", protect, getSubjects);

router.get("/:id", protect, getSubjectById);

export default router;
