import TimetableEntry from "../models/TimetableEntry.js";
import Course from "../models/Course.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import Subject from "../models/Subject.js";
import mongoose from "mongoose";

const PERIODS = [
  { id: "p1", label: "09:00 - 09:50", isBreak: false },
  { id: "p2", label: "10:00 - 10:50", isBreak: false },
  { id: "p3", label: "11:00 - 11:50", isBreak: false },
  { id: "p4", label: "12:00 - 12:50", isBreak: false },
  { id: "p5", label: "01:00 - 01:50", isBreak: false },
  { id: "p6", label: "02:00 - 02:50", isBreak: false },
  { id: "p7", label: "03:00 - 03:50", isBreak: false },
  { id: "p8", label: "04:00 - 04:50", isBreak: false },
  { id: "p9", label: "05:00 - 05:50", isBreak: false },
];

const MAX_LAB_BLOCK = 3;

function getRequiredPeriods(startPeriodId, duration) {
  const startIndex = PERIODS.findIndex((period) => period.id === startPeriodId);

  if (startIndex === -1) {
    return [];
  }

  const result = [];

  for (let i = startIndex; i < startIndex + duration; i++) {
    const period = PERIODS[i];

    if (!period || period.isBreak) {
      return [];
    }

    result.push(period.id);
  }

  return result;
}

// ==================================================
// LAB vs NORMAL ROOMS
//
// A room is a lab when its `type` contains "lab" (same rule the automatic
// generator uses). Everything else is a normal classroom.
//
//   lab-only subject (type "lab", or L+T = 0)   → lab rooms only
//   subject without lab hours (P = 0)           → normal rooms only
//   subject with theory AND lab hours (e.g. 3-0-2)
//        → lectures in normal rooms, the lab block in a lab room
// ==================================================

const isLabRoom = (room) => /lab/i.test(room?.type || "");

function labProfile(subject) {
  const [L = 0, T = 0, P = 0] = subject.ltp || [];

  const labOnly = subject.type === "lab" || (P > 0 && L + T === 0);

  return { labOnly, hasLab: labOnly || P > 0 };
}

function checkVenueType(subject, venue) {
  const { labOnly, hasLab } = labProfile(subject);

  const name = subject.subjectId || subject.name || "This subject";

  if (labOnly && !isLabRoom(venue)) {
    return {
      ok: false,
      message: `${name} is a lab subject — it can only be scheduled in a lab room (${venue.roomNo} is not a lab).`,
    };
  }

  if (!hasLab && isLabRoom(venue)) {
    return {
      ok: false,
      message: `${name} has no lab hours — it cannot be scheduled in a lab room (${venue.roomNo}).`,
    };
  }

  return { ok: true };
}

// A class in a lab room is a lab block and runs for several periods in a row
// (a 0-0-3 lab is ONE class of 3 periods). Anything else is a single period.
function getClassDuration(subject, duration, venue) {
  const labBlock = isLabRoom(venue) && labProfile(subject).hasLab;

  if (!labBlock) {
    return 1;
  }

  // no length sent → the subject's lab length, else its P hours (max 3)
  const [, , P = 0] = subject.ltp || [];

  const fallback = Number(subject.labDuration) || Math.max(P, 1);

  return Math.min(Math.max(Number(duration) || fallback, 1), MAX_LAB_BLOCK);
}

async function checkConflict({
  session,
  course,
  faculty,
  venue,
  day,
  periodIds,
  excludeId = null,
  comboGroupId = null,
}) {
  const filter = {
    session,
    day,
    periodId: {
      $in: periodIds,
    },
    $or: [{ course }, { faculty }, { venue }],
  };

  if (comboGroupId) {
    filter.comboGroupId = {
      $ne: comboGroupId,
    };
  } else if (excludeId) {
    filter._id = {
      $ne: excludeId,
    };
  }

  const conflict = await TimetableEntry.findOne(filter);

  if (!conflict) {
    return {
      ok: true,
    };
  }

  if (String(conflict.course) === String(course)) {
    return {
      ok: false,
      reason:
        "This course already has a class in one or more selected periods.",
    };
  }

  if (String(conflict.faculty) === String(faculty)) {
    return {
      ok: false,
      reason: "Faculty is already scheduled in one or more selected periods.",
    };
  }

  if (String(conflict.venue) === String(venue)) {
    return {
      ok: false,
      reason: "Venue is already occupied in one or more selected periods.",
    };
  }

  return {
    ok: false,
    reason: "This time slot is already occupied.",
  };
}

// ==================================================
// GET TIMETABLE
// ==================================================

export const getTimetable = async (req, res) => {
  try {
    const { courseId, sessionId } = req.query;

    const filter = {};

    if (courseId) {
      filter.course = courseId;
    }

    if (sessionId) {
      filter.session = sessionId;
    }

    const entries = await TimetableEntry.find(filter)
      .populate({
        path: "course",
        select: "courseId semester noOfStudents subjects session",
        populate: [
          {
            path: "subjects.subject",
            select:
              "subjectId name noOfClasses type credits ltp category labDuration",
          },
          {
            path: "subjects.faculty",
            select: "facultyId name designation",
          },
        ],
      })
      .populate({
        path: "subject",
        select:
          "subjectId name noOfClasses type credits ltp category labDuration",
      })
      .populate({
        path: "faculty",
        select: "facultyId name designation noOfClassesPerWeek",
      })
      .populate({
        path: "venue",
        select: "roomNo capacity type category",
      })
      .populate({
        path: "session",
        select: "sessionId",
      })
      .sort({
        day: 1,
        periodId: 1,
      });

    return res.status(200).json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error("GET TIMETABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch timetable",
      error: error.message,
    });
  }
};

// ==================================================
// CREATE CLASS
// ==================================================

export const createTimetableEntry = async (req, res) => {
  try {
    const { courseId, subjectId, facultyId, venueId, day, periodId, duration } =
      req.body;

    if (
      !courseId ||
      !subjectId ||
      !facultyId ||
      !venueId ||
      !day ||
      !periodId
    ) {
      return res.status(400).json({
        success: false,
        message: "Course, subject, faculty, venue, day and period are required",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const assignment = course.subjects.find(
      (item) => String(item.subject) === String(subjectId),
    );

    if (!assignment) {
      return res.status(400).json({
        success: false,
        message: "Subject is not assigned to this course",
      });
    }

    if (
      !assignment.faculty ||
      String(assignment.faculty) !== String(facultyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected faculty is not assigned to this subject",
      });
    }

    const venue = await Room.findById(venueId);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    const venueCheck = checkVenueType(subject, venue);

    if (!venueCheck.ok) {
      return res.status(409).json({
        success: false,
        message: venueCheck.message,
      });
    }

    const classDuration = getClassDuration(subject, duration, venue);

    const requiredPeriods = getRequiredPeriods(periodId, classDuration);

    if (requiredPeriods.length !== classDuration) {
      return res.status(409).json({
        success: false,
        message:
          classDuration > 1
            ? `This class requires ${classDuration} consecutive periods, but there is not enough continuous time from the selected period.`
            : "Invalid period selected.",
      });
    }

    const conflict = await checkConflict({
      session: course.session,
      course: courseId,
      faculty: facultyId,
      venue: venueId,
      day,
      periodIds: requiredPeriods,
    });

    if (!conflict.ok) {
      return res.status(409).json({
        success: false,
        message: conflict.reason,
      });
    }

    const entry = await TimetableEntry.create({
      session: course.session,
      course: courseId,
      subject: subjectId,
      faculty: facultyId,
      venue: venueId,
      day,
      periodId,
      duration: classDuration,
    });

    const populated = await TimetableEntry.findById(entry._id)
      .populate("course")
      .populate("subject")
      .populate("faculty")
      .populate("venue")
      .populate("session");

    return res.status(201).json({
      success: true,
      message: "Class scheduled successfully",
      entry: populated,
    });
  } catch (error) {
    console.error("CREATE TIMETABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create timetable entry",
      error: error.message,
    });
  }
};

// ==================================================
// UPDATE CLASS
// ==================================================

export const updateTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      courseId,
      subjectId,
      facultyId,
      venueId,
      day,
      periodId,
      duration,
      comboGroupId,
    } = req.body;

    const existing = await TimetableEntry.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Timetable entry not found.",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    const actualSubjectId = subjectId || existing.subject;

    const subject = await Subject.findById(actualSubjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    const targetVenueId = venueId || existing.venue;

    const venue = await Room.findById(targetVenueId);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found.",
      });
    }

    const venueCheck = checkVenueType(subject, venue);

    if (!venueCheck.ok) {
      return res.status(409).json({
        success: false,
        message: venueCheck.message,
      });
    }

    // moving a 3-period lab keeps it 3 periods
    const classDuration = getClassDuration(
      subject,
      duration || existing.duration || 1,
      venue,
    );

    const requiredPeriods = getRequiredPeriods(periodId, classDuration);

    if (requiredPeriods.length !== classDuration) {
      return res.status(409).json({
        success: false,
        message: `This class requires ${classDuration} consecutive periods, but there is not enough continuous time from the selected period.`,
      });
    }

    const conflict = await checkConflict({
      session: course.session,
      course: course._id,
      faculty: facultyId,
      venue: targetVenueId,
      day,
      periodIds: requiredPeriods,
      excludeId: existing._id,
      comboGroupId: comboGroupId || existing.comboGroupId,
    });

    if (!conflict.ok) {
      return res.status(409).json({
        success: false,
        message: conflict.reason,
      });
    }

    existing.session = course.session;

    existing.course = course._id;

    existing.subject = actualSubjectId;

    existing.faculty = facultyId;

    existing.venue = targetVenueId;

    existing.day = day;

    existing.periodId = periodId;

    existing.duration = classDuration;

    await existing.save();

    const populatedEntry = await TimetableEntry.findById(existing._id)
      .populate({
        path: "course",
        select: "courseId semester noOfStudents subjects session",
      })
      .populate({
        path: "subject",
        select:
          "subjectId name noOfClasses type credits ltp category labDuration",
      })
      .populate({
        path: "faculty",
        select: "facultyId name designation",
      })
      .populate({
        path: "venue",
        select: "roomNo capacity type category",
      })
      .populate({
        path: "session",
        select: "sessionId",
      });

    return res.status(200).json({
      success: true,
      message: "Class updated successfully.",
      entry: populatedEntry,
    });
  } catch (error) {
    console.error("UPDATE TIMETABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update class.",
      error: error.message,
    });
  }
};

// ==================================================
// DELETE CLASS
// ==================================================

export const deleteTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await TimetableEntry.findByIdAndDelete(id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Timetable entry not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Class removed successfully.",
    });
  } catch (error) {
    console.error("DELETE TIMETABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove class.",
      error: error.message,
    });
  }
};

export const createComboTimetableEntry = async (req, res) => {
  try {
    const {
      course1Id,
      subject1Id,
      course2Id,
      subject2Id,
      facultyId,
      venueId,
      day,
      periodId,
      duration = 1,
    } = req.body;

    // 1. Basic validation
    if (
      !course1Id ||
      !subject1Id ||
      !course2Id ||
      !subject2Id ||
      !facultyId ||
      !venueId ||
      !day ||
      !periodId
    ) {
      return res.status(400).json({
        message: "All combo class fields are required.",
      });
    }

    // 2. Same course cannot be combined with itself
    if (String(course1Id) === String(course2Id)) {
      return res.status(400).json({
        message: "A combo class must contain two different courses.",
      });
    }

    // 3. Verify courses
    const [course1, course2] = await Promise.all([
      Course.findById(course1Id),
      Course.findById(course2Id),
    ]);

    if (!course1 || !course2) {
      return res.status(404).json({
        message: "One or both courses were not found.",
      });
    }

    // 4. Verify subjects
    const [subject1, subject2] = await Promise.all([
      Subject.findById(subject1Id),
      Subject.findById(subject2Id),
    ]);

    if (!subject1 || !subject2) {
      return res.status(404).json({
        message: "One or both subjects were not found.",
      });
    }

    // Check that both subjects are taught by the same faculty

    const assignment1 = course1.subjects.find(
      (item) => String(item.subject) === String(subject1Id),
    );

    const assignment2 = course2.subjects.find(
      (item) => String(item.subject) === String(subject2Id),
    );

    if (!assignment1 || !assignment2) {
      return res.status(400).json({
        message: "One or both subjects are not assigned to their courses.",
      });
    }

    if (
      !assignment1.faculty ||
      !assignment2.faculty ||
      String(assignment1.faculty) !== String(assignment2.faculty)
    ) {
      return res.status(400).json({
        message:
          "Both combo subjects must be taught by the same faculty member.",
      });
    }

    if (String(assignment1.faculty) !== String(facultyId)) {
      return res.status(400).json({
        message: "Selected faculty is not assigned to the first combo subject.",
      });
    }

    // 5. Verify faculty and venue
    const [faculty, venue] = await Promise.all([
      Faculty.findById(facultyId),
      Room.findById(venueId),
    ]);

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found.",
      });
    }

    if (!venue) {
      return res.status(404).json({
        message: "Venue not found.",
      });
    }

    // lab / normal room must suit BOTH subjects
    for (const subject of [subject1, subject2]) {
      const venueCheck = checkVenueType(subject, venue);

      if (!venueCheck.ok) {
        return res.status(409).json({
          message: venueCheck.message,
        });
      }
    }

    // 6. Check whether either course is already occupied
    const courseConflict = await TimetableEntry.findOne({
      course: { $in: [course1Id, course2Id] },
      day,
      periodId,
    });

    if (courseConflict) {
      return res.status(409).json({
        message: "One of the courses already has a class at this time.",
      });
    }

    // 7. Check faculty conflict
    const facultyConflict = await TimetableEntry.findOne({
      faculty: facultyId,
      day,
      periodId,
    });

    if (facultyConflict) {
      return res.status(409).json({
        message: "Faculty is already occupied at this time.",
      });
    }

    // 8. Check venue conflict
    const venueConflict = await TimetableEntry.findOne({
      venue: venueId,
      day,
      periodId,
    });

    if (venueConflict) {
      return res.status(409).json({
        message: "Venue is already occupied at this time.",
      });
    }

    // 9. Generate one ID shared by both entries
    const comboGroupId = new mongoose.Types.ObjectId().toString();

    // 10. Create both entries
    const entries = await TimetableEntry.insertMany([
      {
        course: course1Id,
        subject: subject1Id,
        faculty: facultyId,
        venue: venueId,
        day,
        periodId,
        duration,
        session: course1.session,
        comboGroupId,
      },
      {
        course: course2Id,
        subject: subject2Id,
        faculty: facultyId,
        venue: venueId,
        day,
        periodId,
        duration,
        session: course2.session,
        comboGroupId,
      },
    ]);

    return res.status(201).json({
      ok: true,
      comboGroupId,
      entries,
    });
  } catch (error) {
    console.error("CREATE COMBO CLASS:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};
