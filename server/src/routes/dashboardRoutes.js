import express from "express";

import { getDashboardData } from "../controllers/dashboardController.js";

import protect from "../middleware/authMiddleware.js";
import { can } from "../utils/permissions.js";

const router = express.Router();

/*
 * Don't send people data they may not open:
 *   - only the TT team (and super admin) get every faculty's timetable
 *   - the subject picker is for people who can add subjects to a course
 *   - students never need the faculty list
 */
function trimByRole(req, res, next) {
  const role = req.user?.role;

  const drop = [];

  if (!can(role, "viewAllFacultyTT")) drop.push("facultyTimetables");
  if (!can(role, "addSubjectToCourse")) drop.push("availableSubjects");
  if (!can(role, "viewOwnFacultyTT")) drop.push("faculties");

  if (!drop.length) return next();

  const send = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const copy = { ...body };

      drop.forEach((key) => delete copy[key]);

      return send(copy);
    }

    return send(body);
  };

  next();
}

// any logged-in user
router.get("/:courseId", protect, trimByRole, getDashboardData);

export default router;
