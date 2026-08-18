import Faculty from "../models/Faculty.js";


// CREATE FACULTY
export const createFaculty = async (req, res) => {
  try {
    const {
      facultyId,
      name,
      noOfClassesPerWeek,
      designation,
      subjects = [],
    } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: "Faculty ID is required",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Faculty name is required",
      });
    }

    if (
      noOfClassesPerWeek === undefined ||
      noOfClassesPerWeek === null ||
      noOfClassesPerWeek === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Classes per week is required",
      });
    }

    if (!designation) {
      return res.status(400).json({
        success: false,
        message: "Designation is required",
      });
    }

    const validDesignations = [
      "Assistant Professor",
      "HOD",
      "Professor",
    ];

    if (!validDesignations.includes(designation)) {
      return res.status(400).json({
        success: false,
        message:
          "Designation must be Assistant Professor, HOD or Professor",
      });
    }

    // -----------------------------
    // Duplicate check
    // -----------------------------
    const existingFaculty = await Faculty.findOne({
      facultyId: facultyId.trim(),
    });

    if (existingFaculty) {
      return res.status(409).json({
        success: false,
        message: "Faculty ID already exists",
      });
    }

    // -----------------------------
    // Create faculty
    // -----------------------------
    const faculty = await Faculty.create({
      facultyId: facultyId.trim(),
      name: name.trim(),
      noOfClassesPerWeek: Number(
        noOfClassesPerWeek
      ),
      designation,
      subjects,
    });

    return res.status(201).json({
      success: true,
      message: "Faculty created successfully",
      faculty,
    });
  } catch (error) {
    console.error("CREATE FACULTY ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Faculty ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create faculty",
      error: error.message,
    });
  }
};


// GET ALL FACULTY
export const getFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.find()
      .populate({
        path: "subjects",
        select:
          "subjectId name noOfClasses type credits ltp category",
      })
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      faculty,
    });
  } catch (error) {
    console.error("GET FACULTY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch faculty",
      error: error.message,
    });
  }
};


// GET SINGLE FACULTY
export const getFacultyById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const faculty = await Faculty.findById(id)
      .populate({
        path: "subjects",
        select:
          "subjectId name noOfClasses type credits ltp category",
      });

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    return res.status(200).json({
      success: true,
      faculty,
    });
  } catch (error) {
    console.error("GET FACULTY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch faculty",
      error: error.message,
    });
  }
};