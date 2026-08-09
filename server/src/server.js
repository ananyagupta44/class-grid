import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import Teacher from "./models/Faculty.js";
import Room from "./models/Room.js";
import Subject from "./models/Subject.js";
import Course from "./models/Course.js";

import authRoutes from "./routes/authRoutes.js";
import protect from "./middleware/authMiddleware.js";
import restrictTo from "./middleware/roleMiddleware.js";

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Auth
app.use("/api/auth", authRoutes);

// Teachers
app.get("/api/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch teachers" });
  }
});

app.post("/api/teachers", protect, restrictTo("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.create(req.body);
    res.status(201).json(teacher);
  } catch (err) {
    res.status(500).json({ message: "Failed to create teacher" });
  }
});

// Rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
});

app.post("/api/rooms", protect, restrictTo("admin"), async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: "Failed to create room" });
  }
});

// Subjects
app.get("/api/subjects", async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch subjects" });
  }
});

app.post("/api/subjects", protect, restrictTo("admin"), async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ message: "Failed to create subject" });
  }
});

// Courses
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().populate("subjects");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

app.post("/api/courses", protect, restrictTo("admin"), async (req, res) => {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to create course" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
