import Course from "../models/Course.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

function makeBlocks(subject) {
  const [L = 0, T = 0, P = 0] = subject.ltp || [];

  const blocks = [];

  for (let i = 1; i <= L; i++) {
    blocks.push({
      type: "L",
      number: i,
      label: `L${i}`,
    });
  }

  for (let i = 1; i <= T; i++) {
    blocks.push({
      type: "T",
      number: i,
      label: `T${i}`,
    });
  }

  for (let i = 1; i <= P; i++) {
    blocks.push({
      type: "P",
      number: i,
      label: `P${i}`,
    });
  }

  return blocks;
}

function buildLegend(course, entries) {
  return course.subjects
    .filter((item) => item.subject)
    .map((item) => {
      const subject = item.subject;
      const faculty = item.faculty;

      const scheduled = entries.filter(
        (entry) =>
          String(entry.subject?._id) === String(subject._id) &&
          String(entry.course?._id) === String(course._id),
      ).length;

      const blocks = makeBlocks(subject);

      return {
        subject: {
          id: subject._id,
          subjectId: subject.subjectId,
          name: subject.name,
          noOfClasses: subject.noOfClasses,
          type: subject.type,
          credits: subject.credits,
          ltp: subject.ltp,
          category: subject.category,
        },

        faculty: faculty
          ? {
              id: faculty._id,
              facultyId: faculty.facultyId,
              name: faculty.name,
              designation: faculty.designation,
            }
          : null,

        blocks: blocks.map((block, index) => ({
          ...block,
          scheduled: index < scheduled,
        })),

        remainingBlocks: blocks.slice(scheduled),
      };
    });
}

export const getDashboardData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId)
      .populate({
        path: "session",
        select: "sessionId",
      })
      .populate({
        path: "subjects.subject",
        select: "subjectId name noOfClasses type credits ltp category",
      })
      .populate({
        path: "subjects.faculty",
        select: "facultyId name designation",
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const [faculties, venues, entries] = await Promise.all([
      Faculty.find()
        .populate({
          path: "subjects",
          select: "subjectId name noOfClasses type credits ltp category",
        })
        .sort({ name: 1 }),

      Room.find().sort({ roomNo: 1 }),

      TimetableEntry.find({
        course: course._id,
      })
        .populate("course")
        .populate("subject")
        .populate("faculty")
        .populate("venue")
        .populate("session")
        .sort({
          day: 1,
          periodId: 1,
        }),
    ]);

    return res.status(200).json({
      success: true,

      config: {
        days: DAYS,
        periods: PERIODS,
      },

      course,

      faculties,

      venues,

      entries,

      legend: buildLegend(course, entries),
    });
  } catch (error) {
    console.error("GET DASHBOARD DATA ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
      error: error.message,
    });
  }
};
