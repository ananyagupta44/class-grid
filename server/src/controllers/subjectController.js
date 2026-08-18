import Subject from "../models/Subject.js";

// ==================================================
// CREATE SUBJECT
// ==================================================

export const createSubject = async (req, res) => {
  try {
    const { subjectId, name, noOfClasses, type, credits, ltp, category } =
      req.body;

    // -----------------------------
    // Validation
    // -----------------------------

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Subject ID is required",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required",
      });
    }

    if (
      noOfClasses === undefined ||
      noOfClasses === null ||
      noOfClasses === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Number of classes is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Subject type is required",
      });
    }

    if (!["theory", "lab"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Subject type must be theory or lab",
      });
    }

    if (credits === undefined || credits === null || credits === "") {
      return res.status(400).json({
        success: false,
        message: "Credits are required",
      });
    }

    // -----------------------------
    // LTP validation
    // -----------------------------

    if (!Array.isArray(ltp) || ltp.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "LTP must contain exactly 3 values [L, T, P]",
      });
    }

    // -----------------------------
    // Duplicate subject check
    // -----------------------------

    const existingSubject = await Subject.findOne({
      subjectId: subjectId.trim(),
    });

    if (existingSubject) {
      return res.status(409).json({
        success: false,
        message: "Subject ID already exists",
      });
    }

    // -----------------------------
    // Create subject
    // -----------------------------

    const subject = await Subject.create({
      subjectId: subjectId.trim(),

      name: name.trim(),

      noOfClasses: Number(noOfClasses),

      type,

      credits: Number(credits),

      ltp: ltp.map(Number),

      category: category || "course",

      // IMPORTANT:
      // Subject starts without
      // being assigned to a course.
      courses: [],
    });

    return res.status(201).json({
      success: true,
      message: "Subject created successfully",

      subject,
    });
  } catch (error) {
    console.error("CREATE SUBJECT ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Subject ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create subject",

      error: error.message,
    });
  }
};

// ==================================================
// GET ALL SUBJECTS
// ==================================================

export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate({
        path: "courses",
        select: "courseId semester session",
      })
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      subjects,
    });
  } catch (error) {
    console.error("GET SUBJECTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subjects",

      error: error.message,
    });
  }
};

// ==================================================
// GET SINGLE SUBJECT
// ==================================================

export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id).populate({
      path: "courses",
      select: "courseId semester session",
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    return res.status(200).json({
      success: true,
      subject,
    });
  } catch (error) {
    console.error("GET SUBJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subject",

      error: error.message,
    });
  }
};
