import express from "express";

import { generate } from "../controllers/timetable.controller.js";
import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Auto-generate a session's timetable — admin (TT team) and super admin
router.post(
  "/generate",
  protect,
  requirePermission("generateTimetable"),
  generate,
);

export default router;
