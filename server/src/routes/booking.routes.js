import { Router } from "express";

import auth from "../middleware/auth.js"; // your JWT middleware, adjust path/name
import {
  create,
  list,
  availability,
  approve,
  reject,
} from "../controllers/booking.controller.js";

const router = Router();

router.use(auth);

router.get("/availability", availability); // keep above "/:id" style routes
router.get("/", list);
router.post("/", create);
router.patch("/:id/approve", approve);
router.patch("/:id/reject", reject);

export default router;
