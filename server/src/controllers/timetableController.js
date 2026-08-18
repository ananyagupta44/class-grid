import TimetableEntry from "../models/TimetableEntry.js";
import Course from "../models/Course.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";

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
            select: "subjectId name noOfClasses type credits ltp category",
          },
          {
            path: "subjects.faculty",
            select: "facultyId name designation",
          },
        ],
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
// CHECK CONFLICT
// ==================================================

async function checkConflict({
  session,
  course,
  faculty,
  venue,
  day,
  periodId,
  excludeId = null,
}) {
  const baseFilter = {
    session,
    day,
    periodId,
  };

  if (excludeId) {
    baseFilter._id = {
      $ne: excludeId,
    };
  }

  // -----------------------------------------------
  // Course conflict
  // -----------------------------------------------

  const courseConflict = await TimetableEntry.findOne({
    ...baseFilter,
    course,
  });

  if (courseConflict) {
    return {
      ok: false,
      reason: "This course already has a class in this time slot.",
    };
  }

  // -----------------------------------------------
  // Faculty conflict
  // -----------------------------------------------

  const facultyConflict = await TimetableEntry.findOne({
    ...baseFilter,
    faculty,
  });

  if (facultyConflict) {
    return {
      ok: false,
      reason: "This faculty member already has a class in this time slot.",
    };
  }

  // -----------------------------------------------
  // Venue conflict
  // -----------------------------------------------

  const venueConflict = await TimetableEntry.findOne({
    ...baseFilter,
    venue,
  });

  if (venueConflict) {
    return {
      ok: false,
      reason: "This venue is already occupied in this time slot.",
    };
  }

  return {
    ok: true,
  };
}

// ==================================================
// CREATE CLASS
// ==================================================

export const createTimetableEntry = async (req, res) => {
  try {
    const { courseId, subjectId, facultyId, venueId, day, periodId } = req.body;

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

    const existing = await TimetableEntry.findOne({
      course: courseId,
      day,
      periodId,
    });
    const facultyConflict = await TimetableEntry.findOne({
      faculty: facultyId,
      day,
      periodId,
    });

    if (facultyConflict) {
      return res.status(409).json({
        success: false,
        message: "Faculty is already scheduled in this slot",
      });
    }

    const venueConflict = await TimetableEntry.findOne({
      venue: venueId,
      day,
      periodId,
    });

    if (venueConflict) {
      return res.status(409).json({
        success: false,
        message: "Venue is already occupied in this slot",
      });
    }
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This course already has a class in this slot",
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

    const { courseId, facultyId, venueId, day, periodId } = req.body;

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

    const conflict = await checkConflict({
      session: course.session,

      course: course._id,

      faculty: facultyId,

      venue: venueId,

      day,

      periodId,

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

    existing.faculty = facultyId;

    existing.venue = venueId;

    existing.day = day;

    existing.periodId = periodId;

    await existing.save();

    const populatedEntry = await TimetableEntry.findById(existing._id)
      .populate({
        path: "course",
        select: "courseId semester noOfStudents subjects session",
      })
      .populate({
        path: "faculty",
        select: "facultyId name designation",
      })
      .populate({
        path: "venue",
        select: "roomNo capacity type category",
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
