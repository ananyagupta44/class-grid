import express from "express";

import {
  register,
  createUser,
  login,
  me,
} from "../controllers/authController.js";

import protect from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public
router.post("/register", register); // creates STUDENT accounts only
router.post("/login", login);

// Any logged-in user
router.get("/me", protect, me);

// Super admin — create accounts of any level
router.post("/users", protect, requirePermission("manageAccounts"), createUser);

export default router;
