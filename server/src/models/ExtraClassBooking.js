import mongoose from "mongoose";

const extraClassBookingSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD, exact calendar date
    periodId: { type: String, required: true }, // p1..p9
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
    purpose: { type: String, maxlength: 200 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // true while the booking holds the slot (pending or approved); false once rejected
    active: { type: Boolean, default: true },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);

// DB-level guarantee: only ONE pending/approved booking per room + date + period.
// A rejected booking has active=false, so the room can be requested again.
extraClassBookingSchema.index(
  { room: 1, date: 1, periodId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export default mongoose.models.ExtraClassBooking ||
  mongoose.model("ExtraClassBooking", extraClassBookingSchema);
