/*
 * Which lab room can a lab class use?
 *
 *   room.type     "lab" (or contains "lab") → it is a lab room
 *   room.category e.g. "Chemistry"          → what KIND of lab it is
 *   subject.requiredRoomCategory e.g. "Chemistry"
 *                                           → the kind of lab the subject needs
 *
 * (Subject.category is only "course" / "elective" — it is NOT used here.)
 *
 * Rule for a lab class:
 *   - subject has a requiredRoomCategory AND at least one lab room has it
 *       → it may ONLY use lab rooms of that category
 *         (Chemistry lab class → Chemistry lab only)
 *   - otherwise (no category, or no lab room carries that category)
 *       → any lab room will do
 *
 * Categories are compared ignoring case and surrounding spaces.
 */

export const norm = (value) => String(value ?? "").trim().toLowerCase();

export const isLabRoom = (room) => /lab/i.test(room?.type || "");

/*
 * The category a subject's lab class is tied to, or "" when any lab will do.
 *   rooms     all rooms
 *   isLabFn   how to tell a lab room (defaults to the /lab/ rule above)
 */
export function requiredLabCategory(subject, rooms, isLabFn = isLabRoom) {
  const need = norm(subject?.requiredRoomCategory);

  if (!need) return "";

  const exists = rooms.some(
    (room) => isLabFn(room) && norm(room.category) === need,
  );

  return exists ? need : "";
}

/* ==================================================
   LAB vs NORMAL ROOMS — shared by manual scheduling and combos
   ==================================================

   lab-only subject (type "lab", or L+T = 0)  → lab rooms only
   subject without lab hours (P = 0)          → normal rooms only
   subject with theory AND lab hours (3-0-2)  → lectures in normal rooms,
                                                the lab block in a lab room
   a lab subject with a category (Chemistry)  → only labs of that category
*/

export function labProfile(subject) {
  const [L = 0, T = 0, P = 0] = subject?.ltp || [];

  const labOnly = subject?.type === "lab" || (P > 0 && L + T === 0);

  return { labOnly, hasLab: labOnly || P > 0 };
}

// rooms = every room (needed to know whether a lab category really exists)
export function checkVenueType(subject, venue, rooms = []) {
  const { labOnly, hasLab } = labProfile(subject);

  const name = subject.subjectId || subject.name || "This subject";

  if (labOnly && !isLabRoom(venue)) {
    return {
      ok: false,
      message: `${name} is a lab subject — it can only be scheduled in a lab room (${venue.roomNo} is not a lab).`,
    };
  }

  if (!hasLab && isLabRoom(venue)) {
    return {
      ok: false,
      message: `${name} has no lab hours — it cannot be scheduled in a lab room (${venue.roomNo}).`,
    };
  }

  if (isLabRoom(venue) && hasLab) {
    const need = requiredLabCategory(subject, rooms);

    if (need && norm(venue.category) !== need) {
      return {
        ok: false,
        message: `${name} must be held in a ${String(subject.requiredRoomCategory).trim()} lab (${venue.roomNo} is ${venue.category ? `a ${venue.category}` : "an uncategorised"} lab).`,
      };
    }
  }

  return { ok: true };
}

// A class in a lab room is a lab block and runs for several periods in a row
// (a 0-0-3 lab is ONE class of 3 periods). Anything else is a single period.
export function getClassDuration(subject, duration, venue, maxBlock = 3) {
  const labBlock = isLabRoom(venue) && labProfile(subject).hasLab;

  if (!labBlock) {
    return 1;
  }

  // no length sent → the subject's lab length, else its P hours (max 3)
  const [, , P = 0] = subject.ltp || [];

  // (labDuration defaults to 1 in the Subject model, which means "not set")
  const set = Number(subject.labDuration) > 1 ? Number(subject.labDuration) : 0;

  const fallback = set || Math.max(P, 1);

  return Math.min(Math.max(Number(duration) || fallback, 1), maxBlock);
}
