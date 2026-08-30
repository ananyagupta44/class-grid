import TimetableEntry from "../models/TimetableEntry.js";
import Course from "../models/Course.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import Subject from "../models/Subject.js";

const PERIODS = [
  {
    id: "p1",
    label: "09:00 - 10:00",
    isBreak: false,
  },
  {
    id: "p2",
    label: "10:00 - 11:00",
    isBreak: false,
  },
  {
    id: "p3",
    label: "11:00 - 12:00",
    isBreak: false,
  },
  {
    id: "break1",
    label: "12:00 - 12:30",
    isBreak: true,
  },
  {
    id: "p4",
    label: "12:30 - 01:30",
    isBreak: false,
  },
  {
    id: "p5",
    label: "01:30 - 02:30",
    isBreak: false,
  },
  {
    id: "p6",
    label: "02:30 - 03:30",
    isBreak: false,
  },
  {
    id: "p7",
    label: "03:30 - 04:30",
    isBreak: false,
  },
];

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

function getClassDuration(subject, duration) {
  if (subject.type !== "lab") {
    return 1;
  }

  return Math.min(
    Math.max(Number(duration) || Number(subject.labDuration) || 1, 1),
    3,
  );
}

async function checkConflict({
  session,
  course,
  faculty,
  venue,
  day,
  periodIds,
  excludeId = null,
}) {
  const filter = {
    session,
    day,
    periodId: {
      $in: periodIds,
    },
    $or: [{ course }, { faculty }, { venue }],
  };

  if (excludeId) {
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

    const classDuration = getClassDuration(subject, duration);

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

    const { courseId, subjectId, facultyId, venueId, day, periodId, duration } =
      req.body;

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

    const classDuration = getClassDuration(
      subject,
      duration || existing.duration || 1,
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
      venue: venueId,
      day,
      periodIds: requiredPeriods,
      excludeId: existing._id,
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

    existing.venue = venueId;

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
