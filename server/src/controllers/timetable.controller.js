import mongoose from "mongoose";

import { generateTimetable } from "../services/scheduler.js";

import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import Combo from "../models/Combo.js";
import { checkVenueType } from "../utils/labRooms.js";
import TimetableEntry from "../models/TimetableEntry.js";
import { logAudit } from "../audit/audit.service.js";

// sessions currently being generated (stops two admins clicking at once)
const running = new Set();

const isStrings = (value, max) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= max &&
  value.every((item) => typeof item === "string" && item.length <= 20);

// Only a few harmless options may come from the browser. Search budget,
// weights etc. stay server-side so a request can't hang the server.
function cleanConfig(config = {}) {
  const out = {};

  if (isStrings(config.days, 7)) out.days = config.days;

  if (isStrings(config.periodIds, 15)) out.periodIds = config.periodIds;

  if (Array.isArray(config.noSpanAfter)) {
    out.noSpanAfter = config.noSpanAfter.filter(Number.isInteger);
  }

  const labBlock = Number(config.maxLabBlock);

  if (Number.isInteger(labBlock) && labBlock >= 1 && labBlock <= 4) {
    out.maxLabBlock = labBlock;
  }

  const sectionRun = Number(config.maxConsecutiveSection);

  if (Number.isInteger(sectionRun) && sectionRun >= 2 && sectionRun <= 6) {
    out.maxConsecutiveSection = sectionRun;
  }

  return out;
}

// POST /api/timetable/generate        (admin only)
// body: { sessionId, dryRun?, config?: { days, periodIds, noSpanAfter, maxLabBlock } }
//
//   Combos saved for the session (Combo model) are placed AUTOMATICALLY, before labs
//   and normal classes, as one class with one room for all their courses.
//
//   dryRun: true  → run the scheduler and report, but save NOTHING
//   dryRun: false → REPLACE the session's timetable with the generated one
export const generate = async (req, res) => {
  const { sessionId, dryRun = false, config } = req.body || {};

  if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
    return res.status(400).json({ message: "A valid sessionId is required" });
  }

  if (running.has(String(sessionId))) {
    return res.status(409).json({
      message: "A timetable is already being generated for this session",
    });
  }

  running.add(String(sessionId));

  try {
    const courses = await Course.find({ session: sessionId }).lean();

    if (!courses.length) {
      return res.status(404).json({ message: "No courses in this session" });
    }

    const subjectIds = courses.flatMap((c) => c.subjects.map((s) => s.subject));
    const facultyIds = courses.flatMap((c) =>
      c.subjects.map((s) => s.faculty).filter(Boolean),
    );

    const [subjects, faculties, rooms, existingEntries, combos] = await Promise.all([
      Subject.find({ _id: { $in: subjectIds } }).lean(),
      Faculty.find({ _id: { $in: facultyIds } }).lean(),
      Room.find().lean(),

      // other sessions' timetables: teachers / rooms already busy there
      TimetableEntry.find({ session: { $ne: sessionId } }).lean(),

      // combos made on the site for this session
      Combo.find({ session: sessionId }).lean(),
    ]);

    // every saved combo becomes one joint class (same faculty, same room, all courses together)
    const combinedGroups = combos.map((combo) => ({
      comboId: String(combo._id),
      name: combo.name || "unnamed",
      members: (combo.members || []).map((member) => ({
        course: String(member.course),
        subject: String(member.subject),
      })),
    }));

    // a combined class must pass the same room check as scheduling a combo by hand
    const roomAllowed = (unit, room) =>
      !unit.combined ||
      unit.members.every((member) => checkVenueType(member.subject, room, rooms).ok);

    const result = generateTimetable(
      { courses, subjects, faculties, rooms, existingEntries, combinedGroups },
      { ...cleanConfig(config), roomAllowed },
    );

    if (!result.ok) {
      return res.status(422).json(result);
    }

    // the blocks of one combined class share a comboGroupId, like a combo scheduled by hand
    const blockIds = new Map();

    const entries = result.entries.map(({ comboBlock, ...entry }) => {
      if (comboBlock === undefined) return entry;

      if (!blockIds.has(comboBlock)) {
        blockIds.set(comboBlock, new mongoose.Types.ObjectId().toString());
      }

      return { ...entry, comboGroupId: blockIds.get(comboBlock) };
    });

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        count: result.entries.length,
        cost: result.cost,
        warnings: result.warnings,
        stats: result.stats,
      });
    }

    // keep a copy so the old timetable can be restored if saving fails
    const previous = await TimetableEntry.find({ session: sessionId }).lean();

    await TimetableEntry.deleteMany({ session: sessionId });

    try {
      await TimetableEntry.insertMany(entries);
    } catch (insertError) {
      if (previous.length) await TimetableEntry.insertMany(previous);
      throw insertError;
    }

    await logAudit({
      action: "generate",
      entity: "Timetable",
      entityId: sessionId,
      summary: `Generated timetable for session ${sessionId}: ${result.entries.length} entries saved, ${previous.length} replaced`,
      meta: {
        count: result.entries.length,
        removed: previous.length,
        cost: result.cost,
        combos: combos.length,
        config: cleanConfig(config),
      },
    });

    return res.json({
      ok: true,
      dryRun: false,
      count: result.entries.length,
      removed: previous.length,
      cost: result.cost,
      warnings: result.warnings,
      stats: result.stats,
    });
  } catch (err) {
    console.error("GENERATE TIMETABLE ERROR:", err);

    return res.status(500).json({ message: err.message });
  } finally {
    running.delete(String(sessionId));
  }
};
