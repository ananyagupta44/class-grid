import express from "express";

import {
  createSession,
  getSessions,
  getSessionById,
} from "../controllers/sessionController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create a session — super admin only
router.post("/", protect, requirePermission("addSession"), createSession);

// View sessions — any logged-in user
router.get("/", protect, getSessions);

router.get("/:id", protect, getSessionById);

export default router;
