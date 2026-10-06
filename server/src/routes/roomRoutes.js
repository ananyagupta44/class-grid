import express from "express";

import {
  createRoom,
  getRooms,
  getRoomById,
} from "../controllers/roomController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create venue — admin only
router.post("/", protect, restrictTo("admin"), createRoom);

// Get all venues — any logged-in user (students may view venue timetables)
router.get("/", protect, getRooms);

// Get single venue — any logged-in user
router.get("/:id", protect, getRoomById);

export default router;
