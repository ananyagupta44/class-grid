/*
 * The day's periods — ONE copy, shared by manual scheduling and combos.
 * (The dashboard sends its own period ids to the auto-generator.)
 */

export const PERIODS = [
  { id: "p1", label: "09:00 - 09:50", isBreak: false },
  { id: "p2", label: "10:00 - 10:50", isBreak: false },
  { id: "p3", label: "11:00 - 11:50", isBreak: false },
  { id: "p4", label: "12:00 - 12:50", isBreak: false },
  { id: "p5", label: "01:00 - 01:50", isBreak: false },
  { id: "p6", label: "02:00 - 02:50", isBreak: false },
  { id: "p7", label: "03:00 - 03:50", isBreak: false },
  { id: "p8", label: "04:00 - 04:50", isBreak: false },
  { id: "p9", label: "05:00 - 05:50", isBreak: false },
];

export const MAX_LAB_BLOCK = 3;

// ["p3","p4","p5"] for (p3, 3) — or [] when it doesn't fit in the day
export function getRequiredPeriods(startPeriodId, duration) {
  const startIndex = PERIODS.findIndex((period) => period.id === startPeriodId);

  if (startIndex === -1) {
    return [];
  }

  const result = [];

  for (let i = startIndex; i < startIndex + duration; i++) {
    const period = PERIODS[i];

    if (!period || period.isBreak) {
      return [];
    }

    result.push(period.id);
  }

  return result;
}
