import Course from "../models/Course.js";
import Faculty from "../models/Faculty.js";

export const assignFacultyToSubject = async (req, res) => {
  try {
    const { courseId, subjectId } = req.params;

    const { facultyId } = req.body;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: "Faculty is required",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const faculty = await Faculty.findById(facultyId);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    const assignment = course.subjects.find(
      (item) => String(item.subject) === String(subjectId),
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Subject is not part of this course",
      });
    }

    const oldFaculty = assignment.faculty;

    assignment.faculty = faculty._id;

    await course.save();

    if (oldFaculty && String(oldFaculty) !== String(faculty._id)) {
      await Faculty.findByIdAndUpdate(oldFaculty, {
        $pull: {
          subjects: subjectId,
        },
      });
    }

    await Faculty.findByIdAndUpdate(faculty._id, {
      $addToSet: {
        subjects: subjectId,
      },
    });

    const updatedCourse = await Course.findById(course._id)
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

    return res.status(200).json({
      success: true,
      message: "Faculty assigned successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("ASSIGN FACULTY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign faculty",
      error: error.message,
    });
  }
};
