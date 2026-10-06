import express from "express";

import { getDashboardData } from "../controllers/dashboardController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

/*
 * Students may only see course + venue timetables.
 * Remove the faculty data (and the admin-only subject list) from the
 * dashboard response before it is sent to them.
 */
function trimForStudents(req, res, next) {
  if (req.user?.role !== "student") return next();

  const send = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const { facultyTimetables, faculties, availableSubjects, ...rest } = body;
      return send(rest);
    }

    return send(body);
  };

  next();
}

// any logged-in user
router.get("/:courseId", protect, trimForStudents, getDashboardData);

export default router;
