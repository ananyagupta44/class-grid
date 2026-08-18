import express from "express";

import {
  createSession,
  getSessions,
  getSessionById,
} from "../controllers/sessionController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create session - Admin only
router.post("/", protect, restrictTo("admin"), createSession);

// Get all sessions
router.get("/", getSessions);

// Get single session
router.get("/:id", getSessionById);

export default router;
