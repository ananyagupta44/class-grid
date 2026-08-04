const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, unique: true },
    session: { type: String, enum: ["monsoon", "spring"], required: true },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    slug: { type: String, required: true, unique: true },
    noOfStudents: { type: Number, required: true },
    semester: { type: Number, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Course", courseSchema);
