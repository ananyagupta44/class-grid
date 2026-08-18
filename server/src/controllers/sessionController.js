import Session from "../models/Session.js";

// ==================================================
// CREATE SESSION
// ==================================================

export const createSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const normalizedSessionId = sessionId.trim().toUpperCase();

    // -----------------------------
    // Validate format
    // -----------------------------

    const sessionPattern = /^(MO|SP)\d{2}$/;

    if (!sessionPattern.test(normalizedSessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session format. Use MO26, MO27, SP26, etc.",
      });
    }

    // -----------------------------
    // Check duplicate
    // -----------------------------

    const existingSession = await Session.findOne({
      sessionId: normalizedSessionId,
    });

    if (existingSession) {
      return res.status(409).json({
        success: false,
        message: "Session already exists",
      });
    }

    // -----------------------------
    // Create session
    // -----------------------------

    const session = await Session.create({
      sessionId: normalizedSessionId,

      courses: [],
    });

    return res.status(201).json({
      success: true,
      message: "Session created successfully",

      session,
    });
  } catch (error) {
    console.error("CREATE SESSION ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Session already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create session",

      error: error.message,
    });
  }
};

// ==================================================
// GET ALL SESSIONS
// ==================================================

export const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate({
        path: "courses",
        select: "courseId semester noOfStudents",
      })
      .sort({
        sessionId: -1,
      });

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("GET SESSIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions",

      error: error.message,
    });
  }
};

// ==================================================
// GET SINGLE SESSION
// ==================================================

export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id).populate({
      path: "courses",
      select: "courseId semester noOfStudents subjects",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("GET SESSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch session",

      error: error.message,
    });
  }
};
