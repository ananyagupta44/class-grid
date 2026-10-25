/*
 * Lab blocks for the "Classes to schedule" legend.
 *
 * A lab subject's P hours are NOT separate one-hour classes: a 0-0-3 lab is
 * ONE block that runs for 3 periods in a row. Longer labs are split exactly
 * the way the auto-generator splits them (blocks of at most 3 periods):
 *
 *   P = 2 → [2]      P = 3 → [3]      P = 4 → [2, 2]      P = 6 → [3, 3]
 */

export const MAX_LAB_BLOCK = 3;

const LAB_WORDS = /lab|practical/i;

export const isLabRoom = (room) => LAB_WORDS.test(room?.type || "");

const isLabChip = (block) =>
  LAB_WORDS.test(`${block?.type || ""} ${block?.label || ""}`) ||
  String(block?.type || "").toLowerCase() === "p";

// 6 → [3, 3], 4 → [2, 2], 5 → [2, 3], 3 → [3], 0 → []  (same formula as the generator)
export function splitLabPeriods(periods, maxBlock = MAX_LAB_BLOCK) {
  if (!periods || periods <= 0) return [];

  const count = Math.ceil(periods / maxBlock);

  return Array.from({ length: count }, (_, i) =>
    Math.floor((periods + i) / count),
  );
}

/*
 * item           one legend item: { subject, faculty, remainingBlocks }
 * courseEntries  the timetable entries of the current course
 * getId          reads an id from an id-or-object field
 *
 * Returns the item with its lab chips replaced by whole-block chips that are
 * worked out from PERIODS already scheduled (not from how many entries exist),
 * so a 3-period lab placed once leaves nothing to schedule.
 */
export function withLabBlocks(item, courseEntries, getId) {
  const subject = item?.subject;
  const [L = 0, T = 0, P = 0] = subject?.ltp || [];

  if (!subject || !P) return item;

  const labOnly = subject.type === "lab" || L + T === 0;
  const subjectId = String(subject._id || subject.id);

  // labs already on the timetable: any entry of this subject that sits in a
  // lab room, is longer than one period, or belongs to a lab-only subject
  const placedPeriods = courseEntries
    .filter(
      (entry) =>
        String(getId(entry.subject)) === subjectId &&
        (labOnly || isLabRoom(entry.venue) || (entry.duration || 1) > 1),
    )
    .reduce((total, entry) => total + (entry.duration || 1), 0);

  const blocks = splitLabPeriods(Math.max(P - placedPeriods, 0));

  const existing = item.remainingBlocks || [];

  // keep the backend's lecture / tutorial chips, drop its per-hour lab chips
  const others = labOnly ? [] : existing.filter((block) => !isLabChip(block));

  const labType = existing.find(isLabChip)?.type || "lab";

  return {
    ...item,
    remainingBlocks: [
      ...others,
      ...blocks.map((duration, index) => ({
        type: labType,
        number: index + 1,
        duration,
        label:
          blocks.length > 1
            ? `Lab ${index + 1} (${duration} hrs)`
            : `Lab (${duration} hrs)`,
      })),
    ],
  };
}

/* ==================================================
   COMBO CLASSES in the legend
   ================================================== */

// "courseDbId|subjectDbId" → combo, for every member of every combo
export function comboMemberMap(combos, getId) {
  const map = new Map();

  for (const combo of combos || []) {
    for (const member of combo.members || []) {
      map.set(`${getId(member.course)}|${getId(member.subject)}`, combo);
    }
  }

  return map;
}

/*
 * Blocks of a combo that are still to be placed.
 *   combo          populated combo from GET /combos
 *   courseEntries  timetable entries of the CURRENT course (one entry per
 *                  placed block, so nothing is counted twice)
 *
 * Lecture hours (L+T) are single-period blocks; labs (P) are whole blocks of
 * up to 3 periods, exactly as in splitLabPeriods().
 */
export function comboRemainingBlocks(combo, courseEntries, getId) {
  const subject = combo?.members?.[0]?.subject;
  const [L = 0, T = 0, P = 0] = subject?.ltp || [];

  const groups = new Map(); // comboGroupId -> entry (one per placed block)

  for (const entry of courseEntries) {
    if (String(getId(entry.combo)) !== String(combo._id)) continue;

    const key = entry.comboGroupId || String(entry._id || entry.id);

    if (!groups.has(key)) groups.set(key, entry);
  }

  let lecturesPlaced = 0;
  let labPeriodsPlaced = 0;

  for (const entry of groups.values()) {
    if (isLabRoom(entry.venue)) labPeriodsPlaced += entry.duration || 1;
    else lecturesPlaced += 1;
  }

  const blocks = [];

  const lectures = Math.max(L + T - lecturesPlaced, 0);

  for (let i = 0; i < lectures; i++) {
    blocks.push({ type: "lecture", number: i + 1, duration: 1, label: "Lecture" });
  }

  splitLabPeriods(Math.max(P - labPeriodsPlaced, 0)).forEach((duration, i, all) => {
    blocks.push({
      type: "lab",
      number: i + 1,
      duration,
      label: all.length > 1 ? `Lab ${i + 1} (${duration} hrs)` : `Lab (${duration} hrs)`,
    });
  });

  return blocks;
}

// "CS435 + IT347" unless the combo has its own name
export function comboLabel(combo) {
  if (combo?.name) return combo.name;

  const codes = (combo?.members || [])
    .map((member) => member.subject?.subjectId)
    .filter(Boolean);

  return [...new Set(codes)].join(" + ") || "Combo";
}
