import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      required: true,
      unique: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },

    subjects: [
      {
        subject: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
        },

        faculty: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Faculty",
        },
      },
    ],

    slug: {
      type: String,
      required: true,
      unique: true,
    },

    noOfStudents: {
      type: Number,
      required: true,
    },

    semester: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Course = mongoose.model("Course", courseSchema);

export default Course;
