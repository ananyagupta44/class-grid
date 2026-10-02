"use strict";
/**
 * ClassGrid scheduler — CSP + backtracking (MRV window, forward-check on window, soft-cost value ordering)
 *
 * Variable : one "unit" = one lecture/tutorial period OR one lab block (duration > 1)
 * Domain   : (day, startPeriod, room)
 * Hard     : teacher / room / section double-booking, room capacity, room type,
 *            lab contiguity (same room, consecutive periods, same day), working days/periods,
 *            faculty weekly cap, blocks never span a break
 * Soft     : gaps, teacher consecutive load, capacity fit, room balance, lab room category
 */

const DEFAULTS = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  periods: 10, // P1..P10
  noSpanAfter: [], // e.g. [4] => a lab block cannot run P4 -> P5 (lunch)
  labRoomPattern: /lab/i, // room.type matching this = lab room, everything else = classroom
  maxLabBlock: 4, // lab hours above this get split into several blocks
  maxSameSubjectPerDay: 1, // lecture/tutorial periods of one subject per section per day
  maxConsecutiveTeaching: 2, // 3+ consecutive periods for a teacher is penalised
  weights: {
    gap: 5,
    consecutive: 4,
    capacityFit: 2,
    roomBalance: 1,
    categoryMismatch: 3,
  },
  attempts: 5, // restarts with different tie-breaking; best soft cost wins
  maxNodes: 20000, // search budget per attempt
  branchLimit: 30, // values tried per variable (best-cost first)
  window: 10, // MRV looks at this many hardest remaining units
  seed: 1,
};

// ---------- helpers ----------
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const EMPTY = new Set();
const peek = (m, k) => m.get(k) || EMPTY;
const anyIn = (set, s, e) => {
  for (let p = s; p <= e; p++) if (set.has(p)) return true;
  return false;
};
const gapsOf = (set) => {
  if (set.size < 2) return 0;
  let lo = Infinity,
    hi = -Infinity;
  for (const p of set) {
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  return hi - lo + 1 - set.size;
};
const gapsWith = (set, s, e) => {
  let lo = s,
    hi = e,
    n = e - s + 1;
  for (const p of set) {
    if (p < lo) lo = p;
    if (p > hi) hi = p;
    n++;
  }
  return n < 2 ? 0 : hi - lo + 1 - n;
};
const runLength = (set, s, e) => {
  let run = e - s + 1;
  for (let p = s - 1; set.has(p); p--) run++;
  for (let p = e + 1; set.has(p); p++) run++;
  return run;
};

// ---------- 1. build variables ----------
function buildUnits(courses, subjById, cfg) {
  const units = [];
  const push = (course, subject, faculty, duration, isLab) =>
    units.push({
      id: units.length,
      courses: [course], // array so merged/combined sessions can be added later
      courseIds: [String(course._id)],
      subject,
      subjKeys: [`${course._id}|${subject._id}`],
      faculty,
      facultyId: String(faculty),
      duration,
      isLab,
      size: course.noOfStudents, // merged: sum of sections
    });

  for (const course of courses) {
    for (const { subject: sid, faculty } of course.subjects) {
      const subject = subjById.get(String(sid));
      if (!subject) continue;
      const [L = 0, T = 0, P = 0] = subject.ltp || [];
      let periods = L + T; // each L or T hour = one single-period unit
      const lab = P; // P hours = contiguous lab block(s)
      if (!periods && !lab) periods = subject.noOfClasses || 0; // fallback if ltp missing
      for (let i = 0; i < periods; i++)
        push(course, subject, faculty, 1, false);
      if (lab) {
        const n = Math.ceil(lab / cfg.maxLabBlock);
        for (let i = 0; i < n; i++)
          push(course, subject, faculty, Math.floor((lab + i) / n), true);
      }
    }
  }
  return units;
}

// ---------- 2. preflight: catch impossible input before searching ----------
function preflight(units, rooms, facById, cfg) {
  const errors = [],
    warnings = [];
  const label = (u) =>
    `${u.courses[0].slug || u.courses[0].courseId} / ${u.subject.subjectId || u.subject.name}`;
  const slots = cfg.days.length * cfg.periods;
  const secLoad = new Map(),
    facLoad = new Map();

  for (const u of units) {
    if (!u.rooms.length)
      errors.push(
        `No ${u.isLab ? "lab" : "classroom"} with capacity >= ${u.size} for ${label(u)}`,
      );
    if (u.duration > cfg.periods)
      errors.push(`Block longer than a day: ${label(u)}`);
    for (const cid of u.courseIds)
      secLoad.set(cid, (secLoad.get(cid) || 0) + u.duration);
    facLoad.set(u.facultyId, (facLoad.get(u.facultyId) || 0) + u.duration);
  }
  for (const [cid, n] of secLoad)
    if (n > slots)
      errors.push(
        `Section ${cid} needs ${n} periods but only ${slots} exist per week`,
      );
  for (const [fid, n] of facLoad) {
    const f = facById.get(fid);
    if (!f) {
      warnings.push(`Faculty ${fid} not found in faculties list`);
      continue;
    }
    if (f.noOfClassesPerWeek && n > f.noOfClassesPerWeek)
      errors.push(
        `${f.name} is assigned ${n} periods/week but noOfClassesPerWeek = ${f.noOfClassesPerWeek}`,
      );
    if (n > slots)
      errors.push(
        `${f.name} needs ${n} periods but only ${slots} exist per week`,
      );
  }
  return { errors, warnings, label };
}

// ---------- 3. one search attempt ----------
function runAttempt(ctx, seed) {
  const { cfg, units, existingEntries, facCap } = ctx;
  const rng = mulberry32(seed);
  const nDays = cfg.days.length;
  const facDay = new Map(),
    secDay = new Map(),
    roomDay = new Map();
  const facLoad = new Map(),
    roomLoad = new Map(),
    subjDay = new Map(),
    failCount = new Map();
  const assigned = [];
  let nodes = 0,
    aborted = false;

  const mark = (map, key, s, e, on) => {
    let set = map.get(key);
    if (!set) {
      if (!on) return;
      set = new Set();
      map.set(key, set);
    }
    for (let p = s; p <= e; p++) on ? set.add(p) : set.delete(p);
  };
  const bump = (map, key, by) => map.set(key, (map.get(key) || 0) + by);

  // seed already-existing timetable (other sessions) so we never clash with it
  for (const en of existingEntries) {
    const d = cfg.days.indexOf(en.day);
    const s = parseInt(String(en.periodId).replace(/\D/g, ""), 10);
    if (d < 0 || !s) continue;
    const e = s + (en.duration || 1) - 1;
    mark(facDay, `${en.faculty}|${d}`, s, e, true);
    mark(roomDay, `${en.venue}|${d}`, s, e, true);
    mark(secDay, `${en.course}|${d}`, s, e, true);
  }

  const commit = (u, v, on) => {
    const { d, s } = v,
      e = s + u.duration - 1,
      sign = on ? 1 : -1;
    mark(facDay, `${u.facultyId}|${d}`, s, e, on);
    mark(roomDay, `${v.r.id}|${d}`, s, e, on);
    for (const cid of u.courseIds) mark(secDay, `${cid}|${d}`, s, e, on);
    bump(facLoad, u.facultyId, sign * u.duration);
    bump(roomLoad, v.r.id, sign * u.duration);
    if (!u.isLab) for (const k of u.subjKeys) bump(subjDay, `${k}|${d}`, sign);
  };

  const costOf = (u, d, s, e, r) => {
    const w = cfg.weights;
    let c = 0;
    for (const cid of u.courseIds) {
      // minimise gaps
      const set = peek(secDay, `${cid}|${d}`);
      c += w.gap * (gapsWith(set, s, e) - gapsOf(set));
    }
    const run = runLength(peek(facDay, `${u.facultyId}|${d}`), s, e); // teacher load
    if (run > cfg.maxConsecutiveTeaching)
      c += w.consecutive * (run - cfg.maxConsecutiveTeaching);
    c += (w.capacityFit * (r.capacity - u.size)) / r.capacity; // capacity fit
    c += (w.roomBalance * (roomLoad.get(r.id) || 0)) / (assigned.length + 1); // room balance
    if (
      u.isLab &&
      u.subject.category &&
      r.category &&
      u.subject.category !== r.category
    )
      c += w.categoryMismatch; // right kind of lab
    return c;
  };

  // all hard-valid (day, start, room) for a unit, cheapest soft cost first
  const domain = (u) => {
    const out = [];
    const cap = facCap.get(u.facultyId);
    if (cap && (facLoad.get(u.facultyId) || 0) + u.duration > cap) return out;
    for (let d = 0; d < nDays; d++) {
      if (
        !u.isLab &&
        u.subjKeys.some(
          (k) => (subjDay.get(`${k}|${d}`) || 0) >= cfg.maxSameSubjectPerDay,
        )
      )
        continue;
      const fSet = peek(facDay, `${u.facultyId}|${d}`);
      for (let s = 1; s + u.duration - 1 <= cfg.periods; s++) {
        const e = s + u.duration - 1;
        if (cfg.noSpanAfter.some((b) => b >= s && b < e)) continue; // block would cross a break
        if (anyIn(fSet, s, e)) continue; // teacher double-booking
        if (u.courseIds.some((cid) => anyIn(peek(secDay, `${cid}|${d}`), s, e)))
          continue; // section
        for (const r of u.rooms) {
          if (anyIn(peek(roomDay, `${r.id}|${d}`), s, e)) continue; // room double-booking
          out.push({ d, s, r, cost: costOf(u, d, s, e, r) + rng() * 0.01 });
        }
      }
    }
    return out.sort((a, b) => a.cost - b.cost);
  };

  // hardest first: labs, longer blocks, fewest candidate rooms
  const remaining = units
    .map((u) => [u, rng()])
    .sort(
      ([a, ra], [b, rb]) =>
        b.isLab - a.isLab ||
        b.duration - a.duration ||
        a.rooms.length - b.rooms.length ||
        ra - rb,
    )
    .map(([u]) => u);

  const search = () => {
    if (!remaining.length) return true;
    let pick = -1,
      pickDom = null;
    const w = Math.min(cfg.window, remaining.length);
    for (let i = 0; i < w; i++) {
      // MRV + forward check
      const dom = domain(remaining[i]);
      if (!dom.length) {
        bump(failCount, remaining[i].id, 1);
        return false;
      }
      if (!pickDom || dom.length < pickDom.length) {
        pick = i;
        pickDom = dom;
      }
    }
    const [u] = remaining.splice(pick, 1);
    for (const v of pickDom.slice(0, cfg.branchLimit)) {
      if (++nodes > cfg.maxNodes) {
        aborted = true;
        break;
      }
      commit(u, v, true);
      assigned.push({ u, v });
      if (search()) return true;
      assigned.pop();
      commit(u, v, false);
      if (aborted) break;
    }
    remaining.splice(pick, 0, u);
    return false;
  };

  const solved = search();
  return {
    solved,
    assigned,
    nodes,
    failCount,
    cost: assigned.reduce((t, a) => t + a.v.cost, 0),
  };
}

// ---------- 4. public API ----------
/**
 * @param {{courses, subjects, faculties, rooms, existingEntries?}} data  plain objects (use .lean())
 * @param {object} userConfig  overrides for DEFAULTS
 * @returns {{ok, entries, cost, errors, warnings, stuck, stats}}
 */
function generateTimetable(data, userConfig = {}) {
  const cfg = {
    ...DEFAULTS,
    ...userConfig,
    weights: { ...DEFAULTS.weights, ...userConfig.weights },
  };
  const { courses, subjects, faculties, existingEntries = [] } = data;
  const rooms = data.rooms.map((r) => ({ ...r, id: String(r._id) }));
  const subjById = new Map(subjects.map((s) => [String(s._id), s]));
  const facById = new Map(faculties.map((f) => [String(f._id), f]));
  const facCap = new Map(
    faculties.map((f) => [String(f._id), f.noOfClassesPerWeek || 0]),
  );

  const units = buildUnits(courses, subjById, cfg);
  for (const u of units) {
    u.rooms = rooms
      .filter(
        (r) =>
          (u.isLab
            ? cfg.labRoomPattern.test(r.type || "")
            : !cfg.labRoomPattern.test(r.type || "")) && r.capacity >= u.size,
      )
      .sort((a, b) => a.capacity - b.capacity);
  }

  const { errors, warnings, label } = preflight(units, rooms, facById, cfg);
  if (errors.length)
    return { ok: false, entries: [], errors, warnings, stuck: [], stats: {} };

  const ctx = { cfg, units, existingEntries, facCap };
  let best = null,
    totalNodes = 0;
  const failTotals = new Map();
  for (let a = 0; a < cfg.attempts; a++) {
    const r = runAttempt(ctx, cfg.seed + a);
    totalNodes += r.nodes;
    for (const [id, n] of r.failCount)
      failTotals.set(id, (failTotals.get(id) || 0) + n);
    if (r.solved && (!best || r.cost < best.cost)) best = r;
  }

  if (!best) {
    const stuck = [...failTotals]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => label(units[id]));
    return {
      ok: false,
      entries: [],
      errors: ["No complete timetable found within search budget"],
      warnings,
      stuck,
      stats: { nodes: totalNodes },
    };
  }

  const entries = best.assigned
    .flatMap(({ u, v }) =>
      u.courses.map((c) => ({
        course: c._id,
        subject: u.subject._id,
        faculty: u.faculty,
        session: c.session,
        venue: v.r._id,
        day: cfg.days[v.d],
        periodId: `P${v.s}`,
        duration: u.duration,
      })),
    )
    .sort(
      (a, b) =>
        cfg.days.indexOf(a.day) - cfg.days.indexOf(b.day) ||
        parseInt(a.periodId.slice(1)) - parseInt(b.periodId.slice(1)),
    );

  return {
    ok: true,
    entries,
    cost: best.cost,
    errors: [],
    warnings,
    stuck: [],
    stats: { nodes: totalNodes, units: units.length },
  };
}

export { generateTimetable, DEFAULTS };
