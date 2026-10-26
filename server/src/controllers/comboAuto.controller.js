import mongoose from "mongoose";

import Combo from "../models/Combo.js";
import { suggestCombosForSession } from "../services/comboFinder.js";

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* ==================================================
   GET /combos/auto/suggest?sessionId=&matchBy=name|any
   Shows which combos could be made. Saves NOTHING.
   ================================================== */

export const suggestAutoCombos = async (req, res) => {
  try {
    const { sessionId, matchBy } = req.query;

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return fail(res, 400, "A valid sessionId is required");
    }

    const { candidates, skipped } = await suggestCombosForSession(sessionId, matchBy);

    return res.json({
      success: true,
      count: candidates.length,
      combos: candidates.map((c) => c.summary),
      skipped,
    });
  } catch (error) {
    console.error("SUGGEST COMBOS ERROR:", error);

    return fail(res, 500, "Could not look for combos");
  }
};

/* ==================================================
   POST /combos/auto
   body: { sessionId, matchBy? }
   Finds the combos and SAVES them (pairs already in a combo are left alone).
   ================================================== */

export const createAutoCombos = async (req, res) => {
  try {
    const { sessionId, matchBy } = req.body || {};

    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return fail(res, 400, "A valid sessionId is required");
    }

    const { candidates, skipped } = await suggestCombosForSession(sessionId, matchBy);

    if (!candidates.length) {
      return res.json({
        success: true,
        message: "No new combos found",
        created: 0,
        combos: [],
        skipped,
      });
    }

    // create() runs the normal save hooks, so the audit log gets a line per combo
    const created = await Combo.create(candidates.map((c) => c.combo));

    return res.status(201).json({
      success: true,
      message: `${created.length} combo(s) created`,
      created: created.length,
      combos: candidates.map((c) => c.summary),
      skipped,
    });
  } catch (error) {
    console.error("CREATE AUTO COMBOS ERROR:", error);

    return fail(res, 500, error.message || "Could not create the combos");
  }
};
