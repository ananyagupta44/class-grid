import mongoose from "mongoose";

import Combo from "../models/Combo.js";
import Course from "../models/Course.js";
import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";

import {
  checkVenueType,
  getClassDuration,
  isLabRoom,
  labProfile,
} from "../utils/labRooms.js";
import { MAX_LAB_BLOCK, getRequiredPeriods } from "../utils/periods.js";

/* ---------- helpers ---------- */

const POPULATE = [
  { path: "faculty", select: "facultyId name designation" },
  { path: "members.course", select: "courseId semester noOfStudents session" },
  {
    path: "members.subject",
    select:
      "subjectId name ltp type credits category requiredRoomCategory labDuration",
  },
];

const ltpKey = (subject) =>
  [0, 1, 2].map((i) => Number(subject?.ltp?.[i]) || 0).join("-");

const idOf = (value) =>
  value && typeof value === "object" ? value._id || value.id : value;

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

// total students attending the combined class
const totalStudents = (combo) =>
  combo.members.reduce(
    (total, member) => total + (Number(member.course?.noOfStudents) || 0),
    0,
  );

/* ==================================================
   GET /combos/options?sessionId=
   Every (course, subject) of the session, so the "Create combo" dialog can
   offer them — with the faculty, and whether it is already in a combo.
   ================================================== */

export const getComboOptions = async (req, res) => {
  try {
    let { sessionId } = req.query;
    const { courseId } = req.query;

    // the page may only know the course: find its session from that
    if (!sessionId && courseId && mongoose.isValidObjectId(courseId)) {
      const course = await Course.findById(courseId).select("session").lean();

      sessionId = course?.session;
    }

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return fail(res, 400, "A valid sessionId or courseId is required");
    }

    const [courses, combos] = await Promise.all([
      Course.find({ session: sessionId })
        .populate("subjects.subject", "subjectId name ltp type credits")
        .populate("subjects.faculty", "facultyId name")
        .lean(),
      Combo.find({ session: sessionId }).lean(),
    ]);

    const taken = new Map();

    for (const combo of combos) {
      for (const member of combo.members) {
        taken.set(`${member.course}|${member.subject}`, combo);
      }
    }

    const items = [];

    for (const course of courses) {
      for (const entry of course.subjects || []) {
        if (!entry.subject) continue;

        const combo = taken.get(`${course._id}|${entry.subject._id}`);

        items.push({
          courseDbId: String(course._id),
          courseId: course.courseId,
          semester: course.semester,
          students: course.noOfStudents,
          subjectDbId: String(entry.subject._id),
          subjectCode: entry.subject.subjectId,
          subjectName: entry.subject.name,
          ltp: entry.subject.ltp || [0, 0, 0],
          type: entry.subject.type,
          facultyDbId: entry.faculty ? String(entry.faculty._id) : "",
          facultyName: entry.faculty?.name || "",
          facultyCode: entry.faculty?.facultyId || "",
          inCombo: combo ? String(combo._id) : "",
          inComboName: combo?.name || "",
        });
      }
    }

    items.sort(
      (a, b) =>
        (Number(a.semester) || 0) - (Number(b.semester) || 0) ||
        String(a.courseId).localeCompare(String(b.courseId), undefined, {
          numeric: true,
        }) ||
        String(a.subjectCode).localeCompare(String(b.subjectCode)),
    );

    return res.json({ success: true, items });
  } catch (error) {
    console.error("COMBO OPTIONS ERROR:", error);

    return fail(res, 500, "Could not load the subjects");
  }
};

/* ==================================================
   GET /combos?sessionId=  or  ?courseId=
   ================================================== */

export const listCombos = async (req, res) => {
  try {
    let { sessionId } = req.query;
    const { courseId } = req.query;

    if (!sessionId && courseId && mongoose.isValidObjectId(courseId)) {
      const course = await Course.findById(courseId).select("session").lean();

      sessionId = course?.session;
    }

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return fail(res, 400, "A valid sessionId or courseId is required");
    }

    const combos = await Combo.find({ session: sessionId })
      .populate(POPULATE)
      .sort({ createdAt: 1 });

    return res.json({ success: true, combos });
  } catch (error) {
    console.error("LIST COMBOS ERROR:", error);

    return fail(res, 500, "Could not load combos");
  }
};

/* ==================================================
   POST /combos
   body: { members: [{ courseId, subjectId }, ...], name? }
   ================================================================== */

export const createCombo = async (req, res) => {
  try {
    const { members, name } = req.body || {};

    if (!Array.isArray(members) || members.length < 2) {
      return fail(res, 400, "Choose at least two subjects to combine.");
    }

    if (members.length > 12) {
      return fail(res, 400, "A combo can have at most 12 courses.");
    }

    for (const member of members) {
      if (
        !mongoose.isValidObjectId(member?.courseId) ||
        !mongoose.isValidObjectId(member?.subjectId)
      ) {
        return fail(res, 400, "Each member needs a valid course and subject.");
      }
    }

    // a section cannot attend two things at the same time
    const courseIds = members.map((member) => String(member.courseId));

    if (new Set(courseIds).size !== courseIds.length) {
      return fail(
        res,
        400,
        "A combo can contain each course only once (a course cannot attend two classes at once).",
      );
    }

    const courses = await Course.find({ _id: { $in: courseIds } })
      .populate("subjects.subject", "subjectId name ltp type")
      .lean();

    if (courses.length !== courseIds.length) {
      return fail(res, 404, "One or more courses were not found.");
    }

    const sessions = new Set(courses.map((course) => String(course.session)));

    if (sessions.size !== 1) {
      return fail(res, 400, "All combined courses must be in the same session.");
    }

    // check every (course, subject) pair
    const resolved = [];

    for (const member of members) {
      const course = courses.find(
        (item) => String(item._id) === String(member.courseId),
      );

      const assignment = course.subjects.find(
        (item) => String(idOf(item.subject)) === String(member.subjectId),
      );

      if (!assignment) {
        return fail(
          res,
          400,
          `The subject is not part of ${course.courseId}.`,
        );
      }

      if (!assignment.faculty) {
        return fail(
          res,
          400,
          `Assign a faculty to ${assignment.subject.subjectId} in ${course.courseId} first.`,
        );
      }

      resolved.push({
        course,
        subject: assignment.subject,
        faculty: String(idOf(assignment.faculty)),
      });
    }

    if (new Set(resolved.map((item) => item.faculty)).size !== 1) {
      return fail(
        res,
        400,
        "All combined subjects must be taught by the same faculty member.",
      );
    }

    if (new Set(resolved.map((item) => ltpKey(item.subject))).size !== 1) {
      return fail(
        res,
        400,
        "All combined subjects must have the same L-T-P hours.",
      );
    }

    if (
      new Set(resolved.map((item) => labProfile(item.subject).labOnly)).size !==
      1
    ) {
      return fail(res, 400, "Do not mix lab and theory subjects in one combo.");
    }

    // one pair can only belong to one combo
    for (const item of resolved) {
      const existing = await Combo.findOne({
        members: {
          $elemMatch: { course: item.course._id, subject: item.subject._id },
        },
      }).lean();

      if (existing) {
        return fail(
          res,
          409,
          `${item.subject.subjectId} in ${item.course.courseId} is already in the combo "${existing.name || "unnamed"}".`,
        );
      }
    }

    const defaultName = [
      ...new Set(resolved.map((item) => item.subject.subjectId)),
    ].join(" + ");

    const combo = await Combo.create({
      session: courses[0].session,
      name: String(name || "").trim() || defaultName,
      faculty: resolved[0].faculty,
      members: resolved.map((item) => ({
        course: item.course._id,
        subject: item.subject._id,
      })),
    });

    const populated = await Combo.findById(combo._id).populate(POPULATE);

    return res.status(201).json({
      success: true,
      message: "Combo created",
      combo: populated,
    });
  } catch (error) {
    console.error("CREATE COMBO ERROR:", error);

    return fail(res, 500, error.message || "Could not create the combo");
  }
};

/* ==================================================
   DELETE /combos/:id            (refused while classes are scheduled)
   DELETE /combos/:id?removeClasses=true   (removes them too)
   ================================================== */

export const deleteCombo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid combo id");
    }

    const combo = await Combo.findById(id);

    if (!combo) {
      return fail(res, 404, "Combo not found");
    }

    const scheduled = await TimetableEntry.countDocuments({ combo: combo._id });

    if (scheduled && req.query.removeClasses !== "true") {
      return res.status(409).json({
        success: false,
        scheduled,
        message: `This combo has classes on the timetable. Remove them first, or delete the combo together with its classes.`,
      });
    }

    if (scheduled) await TimetableEntry.deleteMany({ combo: combo._id });

    await combo.deleteOne();

    return res.json({ success: true, message: "Combo deleted" });
  } catch (error) {
    console.error("DELETE COMBO ERROR:", error);

    return fail(res, 500, "Could not delete the combo");
  }
};

/* ==================================================
   POST /combos/:id/schedule
   body: { day, periodId, venueId, duration? }
   Puts ONE block of the combo on the timetable: an entry for every course,
   all sharing the same faculty, venue and time.
   ================================================== */

export const scheduleCombo = async (req, res) => {
  try {
    const { id } = req.params;
    const { day, periodId, venueId, duration } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid combo id");
    }

    if (!day || !periodId || !mongoose.isValidObjectId(venueId)) {
      return fail(res, 400, "Day, period and venue are required.");
    }

    const [combo, venue, rooms] = await Promise.all([
      Combo.findById(id).populate(POPULATE),
      Room.findById(venueId),
      Room.find().lean(),
    ]);

    if (!combo) return fail(res, 404, "Combo not found");
    if (!venue) return fail(res, 404, "Venue not found");

    const subject = combo.members[0].subject;

    // 1. right kind of room, big enough
    for (const member of combo.members) {
      const check = checkVenueType(member.subject, venue, rooms);

      if (!check.ok) return fail(res, 409, check.message);
    }

    const students = totalStudents(combo);

    if (students && venue.capacity < students) {
      return fail(
        res,
        409,
        `${venue.roomNo} seats ${venue.capacity}, but this combo has ${students} students.`,
      );
    }

    // 2. how many periods this block takes, and are hours left?
    const labBlock = isLabRoom(venue);

    const classDuration = getClassDuration(subject, duration, venue, MAX_LAB_BLOCK);

    const [L = 0, T = 0, P = 0] = subject.ltp || [];

    const placed = await TimetableEntry.find({
      combo: combo._id,
      course: combo.members[0].course._id,
    }).populate("venue", "type");

    if (labBlock) {
      const done = placed
        .filter((entry) => isLabRoom(entry.venue))
        .reduce((total, entry) => total + (entry.duration || 1), 0);

      if (done + classDuration > P) {
        return fail(
          res,
          409,
          P - done > 0
            ? `Only ${P - done} lab period(s) of this combo are left to schedule.`
            : "All lab hours of this combo are already scheduled.",
        );
      }
    } else {
      const done = placed.filter((entry) => !isLabRoom(entry.venue)).length;

      if (done >= L + T) {
        return fail(
          res,
          409,
          "All lecture hours of this combo are already scheduled.",
        );
      }
    }

    const requiredPeriods = getRequiredPeriods(periodId, classDuration);

    if (requiredPeriods.length !== classDuration) {
      return fail(
        res,
        409,
        classDuration > 1
          ? `This class needs ${classDuration} consecutive periods, but there is not enough continuous time from the selected period.`
          : "Invalid period selected.",
      );
    }

    // 3. nobody (any course, the faculty, the venue) may be double-booked
    const clash = await TimetableEntry.findOne({
      session: combo.session,
      day,
      periodId: { $in: requiredPeriods },
      $or: [
        { course: { $in: combo.members.map((member) => member.course._id) } },
        { faculty: combo.faculty._id },
        { venue: venue._id },
      ],
    });

    if (clash) {
      return fail(
        res,
        409,
        "One of the combined courses, the faculty or the venue is already booked in those periods.",
      );
    }

    // 4. one entry per course, linked by comboGroupId (this block) and combo
    const comboGroupId = new mongoose.Types.ObjectId().toString();

    const created = await TimetableEntry.insertMany(
      combo.members.map((member) => ({
        session: combo.session,
        course: member.course._id,
        subject: member.subject._id,
        faculty: combo.faculty._id,
        venue: venue._id,
        day,
        periodId,
        duration: classDuration,
        comboGroupId,
        combo: combo._id,
      })),
    );

    return res.status(201).json({
      success: true,
      message: "Combo class scheduled",
      comboGroupId,
      count: created.length,
    });
  } catch (error) {
    console.error("SCHEDULE COMBO ERROR:", error);

    return fail(res, 500, error.message || "Could not schedule the combo");
  }
};
