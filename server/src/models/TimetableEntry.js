import mongoose from "mongoose";

const timetableEntrySchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },

    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    day: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
    },

    periodId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent the same course from being
// scheduled twice in exactly the same slot.

timetableEntrySchema.index(
  {
    session: 1,
    course: 1,
    day: 1,
    periodId: 1,
  },
  {
    unique: true,
  },
);

const TimetableEntry = mongoose.model("TimetableEntry", timetableEntrySchema);

export default TimetableEntry;
