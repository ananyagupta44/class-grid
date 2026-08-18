import express from "express";

import {
  getCourses,
  getCourseById,
  createCourse,
} from "../controllers/courseController.js";
import { assignFacultyToSubject } from "../controllers/courseSubjectController.js";
import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

router.patch(
  "/:courseId/subjects/:subjectId/faculty",
  protect,
  restrictTo("admin"),
  assignFacultyToSubject,
);
// Create course
router.post("/", createCourse);

// Get all courses
router.get("/", getCourses);

// Get single course
router.get("/:id", getCourseById);

export default router;
