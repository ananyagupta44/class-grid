import { Router } from "express";

import auth from "../middleware/authMiddleware.js"; // your JWT middleware, adjust path/name
import { list, filters, exportReport } from "../controllers/audit.controller.js";

const router = Router();

router.use(auth);

router.get("/filters", filters);
router.get("/export", exportReport);
router.get("/", list);

export default router;
