// Pure helpers for ad-hoc / extra class booking (no DB, easy to test)

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const isValidDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// "2026-10-12" -> "Monday" (must match the day names used by the scheduler)
export const dayNameFromDate = (s) => DAY_NAMES[new Date(`${s}T00:00:00Z`).getUTCDay()];

// period ids a timetable entry occupies, e.g. p3 with duration 2 -> ["p3", "p4"]
export const periodsOf = (entry, periodIds) => {
  const start = periodIds.indexOf(entry.periodId);
  return start < 0 ? [] : periodIds.slice(start, start + (entry.duration || 1));
};

export const isBusyInTimetable = (entries, periodIds, periodId) =>
  entries.some((e) => periodsOf(e, periodIds).includes(periodId));
