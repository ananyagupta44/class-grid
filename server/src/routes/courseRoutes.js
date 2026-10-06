import express from "express";

import {
  getCourses,
  getCourseById,
  createCourse,
  getAvailableSubjects,
  addSubjectToCourse,
} from "../controllers/courseController.js";
import { assignFacultyToSubject } from "../controllers/courseSubjectController.js";
import protect from "../middleware/authMiddleware.js";
import restrictTo from "../middleware/roleMiddleware.js";

const router = express.Router();

/*
 * student → read only
 * staff   → read only (they edit timetable entries, not course setup)
 * admin   → everything
 */

// Create course — admin only
router.post("/", protect, restrictTo("admin"), createCourse);

// Get all courses — any logged-in user
router.get("/", protect, getCourses);

// Subjects that can still be added to a course — admin only
router.get(
  "/:courseId/available-subjects",
  protect,
  restrictTo("admin"),
  getAvailableSubjects,
);

// Add subject to a course — admin only
router.post(
  "/:courseId/subjects",
  protect,
  restrictTo("admin"),
  addSubjectToCourse,
);

// Assign faculty to a subject — admin only
router.patch(
  "/:courseId/subjects/:subjectId/faculty",
  protect,
  restrictTo("admin"),
  assignFacultyToSubject,
);

// Get single course — any logged-in user
router.get("/:id", protect, getCourseById);

export default router;