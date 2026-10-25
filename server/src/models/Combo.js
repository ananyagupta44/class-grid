import mongoose from "mongoose";

/*
 * A COMBO CLASS: several courses attend ONE class together, taught by the
 * same faculty (e.g. BTECH7A + BTECH7B share "Cloud Computing").
 *
 * It is stored once. It can then be placed on the timetable by hand, or the
 * auto-generator schedules it as a single block shared by all its courses.
 */

const memberSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
  },
  { _id: false },
);

const comboSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },

    // the one faculty member who teaches the combined class
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },

    // two or more (course, subject) pairs — each course at most once
    members: {
      type: [memberSchema],
      validate: {
        validator: (members) => members.length >= 2,
        message: "A combo needs at least two courses",
      },
    },
  },
  { timestamps: true },
);

comboSchema.index({ session: 1 });

const Combo = mongoose.model("Combo", comboSchema);

export default Combo;
