import express from "express";

import { generate } from "../controllers/timetable.controller.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate", auth, generate);

export default router;
