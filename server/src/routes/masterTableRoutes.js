import express from "express";

import {
  downloadTemplate,
  exportMaster,
  importMaster,
} from "../controllers/masterTable.controller.js";
import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Blank Excel sheet to fill in — dept. in-charge and above
router.get(
  "/template",
  protect,
  requirePermission("addCourse"),
  downloadTemplate,
);

// Download the master table of a session as Excel — anyone who can open the Home page
router.get(
  "/export",
  protect,
  requirePermission("accessHome"),
  exportMaster,
);

// Upload a filled sheet. The browser sends the raw .xlsx file as the request
// body (no multipart), so a raw-body parser is used on this route only.
router.post(
  "/import",
  protect,
  requirePermission("addCourse"),
  express.raw({ type: () => true, limit: "5mb" }),
  importMaster,
);

export default router;
