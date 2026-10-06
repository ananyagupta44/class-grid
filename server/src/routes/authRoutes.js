import express from "express";

import {
  register,
  createUser,
  login,
  me,
} from "../controllers/authController.js";

import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public
router.post("/register", register); // creates STUDENT accounts only
router.post("/login", login);

// Any logged-in user
router.get("/me", protect, me);

// Admin only — create staff / admin accounts
router.post("/users", protect, restrictTo("admin"), createUser);

export default router;
