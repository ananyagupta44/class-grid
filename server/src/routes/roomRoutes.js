import express from "express";

import {
  createRoom,
  getRooms,
  getRoomById,
} from "../controllers/roomController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Add a venue — super admin only
router.post("/", protect, requirePermission("addRoom"), createRoom);

// View venues — any logged-in user (everyone can open venue timetables)
router.get("/", protect, getRooms);

router.get("/:id", protect, getRoomById);

export default router;
