const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Session = require("./models/Session");
const { buildVariables, solve } = require("./scheduler/scheduler");

const Teacher = require("./models/Faculty");
const Room = require("./models/Room");
const Subject = require("./models/Subject");
const Course = require("./models/Course");

const authRoutes = require("./routes/authRoutes");
const protect = require("./middleware/authMiddleware");
const restrictTo = require("./middleware/roleMiddleware");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Auth
app.use("/api/auth", authRoutes);

// Teachers
app.get("/api/teachers", async (req, res) => res.json(await Teacher.find()));
app.post("/api/teachers", protect, restrictTo("admin"), async (req, res) =>
  res.json(await Teacher.create(req.body)),
);

// Rooms
app.get("/api/rooms", async (req, res) => res.json(await Room.find()));
app.post("/api/rooms", protect, restrictTo("admin"), async (req, res) =>
  res.json(await Room.create(req.body)),
);

// Subjects
app.get("/api/subjects", async (req, res) => res.json(await Subject.find()));
app.post("/api/subjects", protect, restrictTo("admin"), async (req, res) =>
  res.json(await Subject.create(req.body)),
);

// Courses
app.get("/api/courses", async (req, res) =>
  res.json(await Course.find().populate("subjects")),
);
app.post("/api/courses", protect, restrictTo("admin"), async (req, res) =>
  res.json(await Course.create(req.body)),
);
// Timetable
app.get("/api/timetable", async (req, res) => {
  const sessions = await Session.find()
    .populate("course", "courseId slug")
    .populate("subject", "name type")
    .populate("faculty", "name")
    .populate("room", "roomNo");
  res.json({ sessions });
});

app.post("/api/timetable/generate", protect, restrictTo("admin"), async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("subjects.subject")
      .populate("subjects.faculty");
    const rooms = await Room.find();

    const variables = buildVariables(courses);
    const result = solve(variables, rooms);

    if (!result.success) {
      return res.status(422).json({
        message: "Could not generate a full timetable — some sessions could not be placed.",
        unplaceable: result.unplaceable.map((v) => ({
          courseId: v.courseId,
          subjectId: v.subjectId,
          facultyId: v.facultyId,
        })),
      });
    }

    await Session.deleteMany({});
    await Session.insertMany(
      result.schedule.map((s) => ({
        course: s.courseId,
        subject: s.subjectId,
        faculty: s.facultyId,
        room: s.roomId,
        day: s.day,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
      }))
    );

    res.json({ message: "Timetable generated successfully.", totalSessions: result.schedule.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
