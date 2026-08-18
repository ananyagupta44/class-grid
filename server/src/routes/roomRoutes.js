import express from "express";

import {
  createRoom,
  getRooms,
  getRoomById,
} from "../controllers/roomController.js";

const router = express.Router();


// Create venue
router.post("/", createRoom);


// Get all venues
router.get("/", getRooms);


// Get single venue
router.get("/:id", getRoomById);


export default router;