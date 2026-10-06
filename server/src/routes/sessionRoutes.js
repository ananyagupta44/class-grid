import express from "express";

import {
  createSession,
  getSessions,
  getSessionById,
} from "../controllers/sessionController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create session — admin only
router.post("/", protect, restrictTo("admin"), createSession);

// Get all sessions — any logged-in user
router.get("/", protect, getSessions);

// Get single session — any logged-in user
router.get("/:id", protect, getSessionById);

export default router;
