const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
