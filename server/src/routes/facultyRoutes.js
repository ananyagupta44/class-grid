import express from "express";

import {
  createFaculty,
  getFaculty,
  getFacultyById,
} from "../controllers/facultyController.js";

const router = express.Router();


// Create faculty
router.post("/", createFaculty);


// Get all faculty
router.get("/", getFaculty);


// Get single faculty
router.get("/:id", getFacultyById);


export default router;