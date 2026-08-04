require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const Teacher = require("./models/Faculty");
const Room = require("./models/Room");

const Subject = require("./models/Subject");
const Course = require("./models/Course");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Teachers
app.get("/api/teachers", async (req, res) => res.json(await Teacher.find()));
app.post("/api/teachers", async (req, res) =>
  res.json(await Teacher.create(req.body)),
);

// // Rooms
app.get("/api/rooms", async (req, res) => res.json(await Room.find()));
app.post("/api/rooms", async (req, res) =>
  res.json(await Room.create(req.body)),
);

// // Subjects
app.get("/api/subjects", async (req, res) => res.json(await Subject.find()));
app.post("/api/subjects", async (req, res) =>
  res.json(await Subject.create(req.body)),
);

app.get("/api/courses", async (req, res) =>
  res.json(await Course.find().populate("subjects")),
);
app.post("/api/courses", async (req, res) =>
  res.json(await Course.create(req.body)),
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
