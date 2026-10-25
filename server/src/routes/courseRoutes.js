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
import { requirePermission } from "../middleware/roleMiddleware.js";
import { updateCourse } from "../controllers/editController.js";


const router = express.Router();

// Add a new course — dept. in-charge and above
router.post("/", protect, requirePermission("addCourse"), createCourse);

// View courses — any logged-in user
router.get("/", protect, getCourses);

// Subjects that can still be added to a course — dept. in-charge and above
router.get(
  "/:courseId/available-subjects",
  protect,
  requirePermission("addSubjectToCourse"),
  getAvailableSubjects,
);

// Add a subject to a course — dept. in-charge and above
router.post(
  "/:courseId/subjects",
  protect,
  requirePermission("addSubjectToCourse"),
  addSubjectToCourse,
);

// Assign faculty to a subject — dept. in-charge and above
router.patch(
  "/:courseId/subjects/:subjectId/faculty",
  protect,
  requirePermission("assignFaculty"),
  assignFacultyToSubject,
);

// View one course — any logged-in user
router.get("/:id", protect, getCourseById);


router.put("/:id", protect, requirePermission("addCourse"), updateCourse);

export default router;
