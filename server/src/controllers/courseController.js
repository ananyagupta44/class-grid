import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Session from "../models/Session.js";

// ==================================================
// CREATE COURSE
// ==================================================

export const createCourse = async (req, res) => {
  try {
    const {
      courseId,
      sessionId,
      semester,
      noOfStudents,
      subjects = [],
    } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session is required",
      });
    }

    if (semester === undefined || semester === null || semester === "") {
      return res.status(400).json({
        success: false,
        message: "Semester is required",
      });
    }

    if (
      noOfStudents === undefined ||
      noOfStudents === null ||
      noOfStudents === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Number of students is required",
      });
    }

    // ==================================================
    // NORMALIZE COURSE ID
    // ==================================================

    const normalizedCourseId = courseId.trim().toUpperCase();

    // ==================================================
    // NORMALIZE SESSION ID
    // ==================================================

    const normalizedSessionId = sessionId.trim().toUpperCase();

    // ==================================================
    // CHECK IF SESSION EXISTS
    // ==================================================

    const session = await Session.findOne({
      sessionId: normalizedSessionId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Session ${normalizedSessionId} not found`,
      });
    }

    // ==================================================
    // CHECK DUPLICATE COURSE
    // ==================================================

    const existingCourse = await Course.findOne({
      courseId: normalizedCourseId,
    });

    if (existingCourse) {
      return res.status(409).json({
        success: false,
        message: "Course already exists",
      });
    }

    // ==================================================
    // VALIDATE SUBJECTS
    // ==================================================

    const courseSubjects = [];
    const selectedSubjectIds = [];

    /*
      Subjects are OPTIONAL.

      These are all valid:

      subjects: []

      OR

      no subjects field at all

      OR

      subjects: [
        { subjectId: "DSA" },
        { subjectId: "DBMS" }
      ]
    */

    if (Array.isArray(subjects)) {
      for (const item of subjects) {
        const subjectId =
          typeof item === "string" ? item : item?.subjectId || item?.id;

        // Ignore invalid empty entries
        if (!subjectId) {
          continue;
        }

        // Find subject using subjectId
        const subject = await Subject.findOne({
          subjectId: subjectId.trim(),
        });

        if (!subject) {
          return res.status(404).json({
            success: false,
            message: `Subject ${subjectId} not found`,
          });
        }

        // Prevent duplicate subjects
        if (
          selectedSubjectIds.some(
            (id) => id.toString() === subject._id.toString(),
          )
        ) {
          continue;
        }

        // Add subject to Course
        courseSubjects.push({
          subject: subject._id,

          // Faculty will be assigned later
          faculty: null,
        });

        selectedSubjectIds.push(subject._id);
      }
    }

    // ==================================================
    // GENERATE SLUG
    // ==================================================

    const slug = normalizedCourseId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // ==================================================
    // CREATE COURSE
    // ==================================================

    const course = await Course.create({
      courseId: normalizedCourseId,

      // Session reference
      session: session._id,

      semester: Number(semester),

      noOfStudents: Number(noOfStudents),

      // Can be empty
      subjects: courseSubjects,

      slug,
    });

    // ==================================================
    // ADD COURSE TO SESSION
    // ==================================================

    await Session.findByIdAndUpdate(session._id, {
      $addToSet: {
        courses: course._id,
      },
    });

    // ==================================================
    // ADD COURSE TO EACH SUBJECT
    // ==================================================

    if (selectedSubjectIds.length > 0) {
      await Subject.updateMany(
        {
          _id: {
            $in: selectedSubjectIds,
          },
        },
        {
          $addToSet: {
            courses: course._id,
          },
        },
      );
    }

    // ==================================================
    // GET POPULATED COURSE
    // ==================================================

    const populatedCourse = await Course.findById(course._id)
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

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(201).json({
      success: true,

      message: "Course created successfully",

      course: populatedCourse,
    });
  } catch (error) {
    console.error("CREATE COURSE ERROR:", error);

    // Duplicate key
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Course ID or slug already exists",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to create course",

      error: error.message,
    });
  }
};

// GET ALL COURSES
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate({
        path: "subjects.subject",
        select: "subjectId name noOfClasses type credits ltp category",
      })
      .populate({
        path: "subjects.faculty",
        select: "facultyId name designation",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error("GET COURSES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
};

// GET SINGLE COURSE
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id)
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

    return res.status(200).json({
      success: true,
      course,
    });
  } catch (error) {
    console.error("GET COURSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch course",
      error: error.message,
    });
  }
};
