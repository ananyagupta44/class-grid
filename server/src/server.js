import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import facultyRoutes from "./routes/facultyRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";

// __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// MongoDB Connection
// --------------------------------------------------

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// --------------------------------------------------
// Routes
// --------------------------------------------------

// Authentication
app.use("/api/auth", authRoutes);

// Courses
app.use("/api/courses", courseRoutes);

// Faculty
app.use("/api/faculty", facultyRoutes);

// Rooms / Venues
app.use("/api/rooms", roomRoutes);

app.use("/api/subjects", subjectRoutes);

app.use("/api/sessions", sessionRoutes);

app.use("/api/timetable", timetableRoutes);

// --------------------------------------------------
// Health Check
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ClassGrid backend is running",
  });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
