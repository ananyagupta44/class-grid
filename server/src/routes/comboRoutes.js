import express from "express";

import {
  getComboOptions,
  listCombos,
  createCombo,
  deleteCombo,
  scheduleCombo,
} from "../controllers/comboController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// View combos — any logged-in user
router.get("/", protect, listCombos);

// Everything below: admin (TT team) and super admin
router.get(
  "/options",
  protect,
  requirePermission("manageCombos"),
  getComboOptions,
);

router.post("/", protect, requirePermission("manageCombos"), createCombo);

router.post(
  "/:id/schedule",
  protect,
  requirePermission("manageCombos"),
  scheduleCombo,
);

router.delete("/:id", protect, requirePermission("manageCombos"), deleteCombo);

export default router;
