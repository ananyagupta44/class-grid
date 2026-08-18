import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    subjectId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    noOfClasses: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ["theory", "lab"],
      required: true,
    },

    credits: {
      type: Number,
      required: true,
    },

    // [L, T, P]
    ltp: {
      type: [Number],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 3,

        message: "LTP must have exactly 3 values [L, T, P]",
      },
    },

    category: {
      type: String,
      enum: ["elective", "course"],
      default: "course",
    },

    // Courses in which this subject is offered
    // Empty when the subject is first created
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },

  {
    timestamps: true,
  },
);

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
