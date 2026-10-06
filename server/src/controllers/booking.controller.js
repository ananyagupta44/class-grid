import mongoose from "mongoose";

import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";
import ExtraClassBooking from "../models/ExtraClassBooking.js";
import { DEFAULTS } from "../services/scheduler.js";
import {
  isValidDate,
  dayNameFromDate,
  periodsOf,
  isBusyInTimetable,
} from "../services/bookingRules.js";

// must match the periodIds used when the timetable was generated
const PERIOD_IDS =
  DEFAULTS.periodIds ||
  Array.from({ length: DEFAULTS.periods }, (_, i) => `p${i + 1}`);

// roles allowed to approve / reject (adjust to the role values in your users collection)
const REVIEW_ROLES = ["admin", "hod"];
const canReview = (user) =>
  REVIEW_ROLES.includes(String(user?.role || "").toLowerCase());
const userId = (req) => req.user?._id || req.user?.id;

const todayStr = () => {
  const n = new Date();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${n.getFullYear()}-${m}-${d}`;
};

// Rule 1: room must be free in the regular timetable AND in booking records
// for that exact date + period. Returns a message if blocked, otherwise null.
async function roomConflict(roomId, date, periodId, ignoreBookingId) {
  const regular = await TimetableEntry.find({
    venue: roomId,
    day: dayNameFromDate(date),
  }).lean();

  if (isBusyInTimetable(regular, PERIOD_IDS, periodId)) {
    return "Room is occupied in the regular timetable at that time";
  }

  const query = { room: roomId, date, periodId, active: true };
  if (ignoreBookingId) query._id = { $ne: ignoreBookingId };

  const existing = await ExtraClassBooking.findOne(query).lean();
  if (existing) {
    return existing.status === "approved"
      ? "Room is already booked for an extra class at that time"
      : "Another request for this room, date and period is pending approval";
  }
  return null;
}

// POST /api/bookings   body: { room, date: "YYYY-MM-DD", periodId, course?, faculty?, purpose? }
export const create = async (req, res) => {
  try {
    const { room, date, periodId, course, faculty, purpose } = req.body || {};

    if (!mongoose.isValidObjectId(room)) {
      return res.status(400).json({ message: "A valid room is required" });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }
    if (date < todayStr()) {
      return res.status(400).json({ message: "Cannot book a past date" });
    }
    if (!PERIOD_IDS.includes(periodId)) {
      return res.status(400).json({ message: `periodId must be one of ${PERIOD_IDS.join(", ")}` });
    }
    if (!(await Room.exists({ _id: room }))) {
      return res.status(404).json({ message: "Room not found" });
    }

    const conflict = await roomConflict(room, date, periodId);
    if (conflict) return res.status(409).json({ message: conflict });

    try {
      const booking = await ExtraClassBooking.create({
        room,
        date,
        periodId,
        course: mongoose.isValidObjectId(course) ? course : undefined,
        faculty: mongoose.isValidObjectId(faculty) ? faculty : undefined,
        purpose: typeof purpose === "string" ? purpose.slice(0, 200) : undefined,
        requestedBy: userId(req),
      });
      return res.status(201).json(booking);
    } catch (err) {
      // two requests raced past the check: the unique index stops the second one
      if (err.code === 11000) {
        return res.status(409).json({
          message: "Another request for this room, date and period already exists",
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("CREATE BOOKING ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/bookings/availability?date=YYYY-MM-DD&periodId=p3&minCapacity=60
// rooms that are free for an extra class at that date + period
export const availability = async (req, res) => {
  try {
    const { date, periodId, minCapacity } = req.query;

    if (!isValidDate(date) || !PERIOD_IDS.includes(periodId)) {
      return res.status(400).json({ message: "Valid date and periodId are required" });
    }

    const [rooms, entries, bookings] = await Promise.all([
      Room.find().lean(),
      TimetableEntry.find({ day: dayNameFromDate(date) }).lean(),
      ExtraClassBooking.find({ date, periodId, active: true }).lean(),
    ]);

    const busy = new Set(bookings.map((b) => String(b.room)));
    for (const e of entries) {
      if (periodsOf(e, PERIOD_IDS).includes(periodId)) busy.add(String(e.venue));
    }

    const min = Number(minCapacity) || 0;
    const free = rooms.filter((r) => !busy.has(String(r._id)) && r.capacity >= min);

    return res.json({ date, periodId, count: free.length, rooms: free });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/bookings?status=pending&date=YYYY-MM-DD
// admin/HOD see everyone's requests, others see only their own
export const list = async (req, res) => {
  try {
    const filter = {};
    if (!canReview(req.user)) filter.requestedBy = userId(req);
    if (["pending", "approved", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (isValidDate(req.query.date)) filter.date = req.query.date;

    const items = await ExtraClassBooking.find(filter)
      .populate("room", "roomNo type capacity")
      .sort({ date: 1, createdAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /api/bookings/:id/approve | /reject   body: { note? }   (admin / HOD only)
const review = (decision) => async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res.status(403).json({ message: "Only admin or HOD can review bookings" });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const booking = await ExtraClassBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status !== "pending") {
      return res.status(409).json({ message: `Booking is already ${booking.status}` });
    }

    // the regular timetable may have been regenerated since the request was made
    if (decision === "approved") {
      const conflict = await roomConflict(booking.room, booking.date, booking.periodId, booking._id);
      if (conflict) return res.status(409).json({ message: conflict });
    }

    booking.status = decision;
    booking.active = decision === "approved"; // rejected => room free for others again
    booking.reviewedBy = userId(req);
    booking.reviewedAt = new Date();
    if (typeof req.body?.note === "string") booking.reviewNote = req.body.note.slice(0, 200);

    await booking.save();
    return res.json(booking);
  } catch (err) {
    console.error("REVIEW BOOKING ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

export const approve = review("approved");
export const reject = review("rejected");
