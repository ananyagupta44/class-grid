import { generateTimetable } from "../services/scheduler.js";

import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";

// POST /api/timetable/generate
// body: { sessionId, config? }

export const generate = async (req, res) => {
  try {
    const { sessionId, config } = req.body;

    const courses = await Course.find({ session: sessionId }).lean();

    if (!courses.length) {
      return res.status(404).json({ message: "No courses in this session" });
    }

    const subjectIds = courses.flatMap((c) => c.subjects.map((s) => s.subject));

    const facultyIds = courses.flatMap((c) => c.subjects.map((s) => s.faculty));

    const [subjects, faculties, rooms, existingEntries] = await Promise.all([
      Subject.find({ _id: { $in: subjectIds } }).lean(),

      Faculty.find({ _id: { $in: facultyIds } }).lean(),

      Room.find().lean(),

      // Other sessions' timetables:
      // teachers/rooms already busy there
      TimetableEntry.find({
        session: { $ne: sessionId },
      }).lean(),
    ]);

    const result = generateTimetable(
      {
        courses,
        subjects,
        faculties,
        rooms,
        existingEntries,
      },
      config,
    );

    if (!result.ok) {
      return res.status(422).json(result);
    }

    await TimetableEntry.deleteMany({
      session: sessionId,
    });

    await TimetableEntry.insertMany(result.entries);

    res.json({
      ok: true,
      count: result.entries.length,
      cost: result.cost,
      warnings: result.warnings,
      stats: result.stats,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
