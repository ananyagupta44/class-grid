import express from "express";

import { generate } from "../controllers/timetable.controller.js";
import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Auto-generate a timetable — admin only (it is a Home-page / management action)
router.post("/generate", protect, restrictTo("admin"), generate);

export default router;
