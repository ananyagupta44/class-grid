import mongoose from "mongoose";

const facultySchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],

    noOfClassesPerWeek: {
      type: Number,
      required: true,
    },

    designation: {
      type: String,
      enum: ["Assistant Professor", "HOD", "Professor"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Faculty = mongoose.model("Faculty", facultySchema);

export default Faculty;
