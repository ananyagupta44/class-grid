/**
 * TIMETABLE SCHEDULING ENGINE
 * CSP (Constraint Satisfaction Problem) solved via Backtracking Search
 */

// ─── 0. CONFIG ──────────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS_PER_DAY = 10;
const MAX_BACKTRACK_STEPS = 200000;

// ─── 1. BUILD VARIABLES ─────────────────────────────────────────────────
function buildVariables(courses) {
  const variables = [];

  for (const course of courses) {
    for (const entry of course.subjects) {
      const subject = entry.subject;
      const faculty = entry.faculty;

      if (!subject || !faculty) continue;

      const isLab = subject.type === "lab";
      const [L, T, P] = subject.ltp || [subject.noOfClasses || 1, 0, 0];

      if (isLab) {
        const labBatches = Math.max(entry.labBatches || 1, 1);
        const labGroupId = `${course._id}_${subject._id}_lab`;
        const batchSize =
          labBatches > 1
            ? Math.ceil(course.noOfStudents / labBatches)
            : course.noOfStudents;

        for (let b = 0; b < labBatches; b++) {
          variables.push({
            id: `${labGroupId}_batch${b}`,
            labGroupId,
            batchIndex: b,
            courseId: course._id,
            subjectId: subject._id,
            facultyId: faculty._id,
            batchSize,
            duration: Math.max(P, 1),
            requiredRoomType: "lab",
            requiredRoomCategory: subject.requiredRoomCategory || null,
          });
        }
      } else {
        const weeklyLectures = Math.max(L, 1);
        for (let i = 0; i < weeklyLectures; i++) {
          variables.push({
            id: `${course._id}_${subject._id}_lec_${i}`,
            courseId: course._id,
            subjectId: subject._id,
            facultyId: faculty._id,
            batchSize: course.noOfStudents,
            duration: 1,
            requiredRoomType: "class",
            requiredRoomCategory: null,
          });
        }
      }
    }
  }

  return variables;
}

// ─── 2. BUILD DOMAINS ───────────────────────────────────────────────────
function buildDomain(variable, rooms) {
  const domain = [];

  const eligibleRooms = rooms.filter((r) => {
    if (r.type !== variable.requiredRoomType) return false;
    if (variable.requiredRoomCategory && r.category !== variable.requiredRoomCategory) {
      return false;
    }
    if (r.capacity < variable.batchSize) return false;
    return true;
  });

  for (const day of DAYS) {
    for (let start = 1; start + variable.duration - 1 <= PERIODS_PER_DAY; start++) {
      for (const room of eligibleRooms) {
        domain.push({
          day,
          periodStart: start,
          periodEnd: start + variable.duration - 1,
          roomId: room._id.toString(),
        });
      }
    }
  }

  return domain;
}

// ─── 3. CONSTRAINT CHECKING ─────────────────────────────────────────────
function isValidPlacement(variable, value, assigned) {
  const overlapsPeriod = (aStart, aEnd, bStart, bEnd) =>
    aStart <= bEnd && bStart <= aEnd;

  for (const other of assigned) {
    if (other.day !== value.day) continue;
    if (!overlapsPeriod(value.periodStart, value.periodEnd, other.periodStart, other.periodEnd)) {
      continue;
    }
    if (other.facultyId === variable.facultyId) return false;
    if (other.roomId === value.roomId) return false;
    if (other.courseId.toString() === variable.courseId.toString()) return false;
  }

  return true;
}

// ─── 4. BACKTRACKING SEARCH ─────────────────────────────────────────────
function pickNextVariable(unassigned, domains) {
  let best = null;
  let bestSize = Infinity;
  for (const v of unassigned) {
    const size = domains[v.id].length;
    if (size < bestSize) {
      bestSize = size;
      best = v;
    }
  }
  return best;
}

function solve(variables, rooms) {
  const domains = {};
  for (const v of variables) {
    domains[v.id] = buildDomain(v, rooms);
  }

  const assigned = [];
  let steps = 0;
  const unplaceable = [];

  function backtrack(remaining) {
    if (remaining.length === 0) return true;
    steps++;
    if (steps > MAX_BACKTRACK_STEPS) {
      throw new Error(
        "Backtracking limit exceeded — dataset likely over-constrained (too many classes for available rooms/time). Check faculty and room counts."
      );
    }

    const variable = pickNextVariable(remaining, domains);
    const nextRemaining = remaining.filter((v) => v.id !== variable.id);

    for (const value of domains[variable.id]) {
      if (!isValidPlacement(variable, value, assigned)) continue;

      const placement = { ...variable, ...value };
      assigned.push(placement);

      if (backtrack(nextRemaining)) return true;

      assigned.pop();
    }

    unplaceable.push(variable);
    return false;
  }

  const success = backtrack(variables);

  return { success, schedule: assigned, unplaceable };
}

// ─── 5. SOFT CONSTRAINT SCORING ──────────────────────────────────────────
function scoreSchedule(schedule) {
  let penalty = 0;

  const byCourseDay = {};
  const byFacultyDay = {};

  for (const s of schedule) {
    const cKey = `${s.courseId}_${s.day}`;
    const fKey = `${s.facultyId}_${s.day}`;
    (byCourseDay[cKey] = byCourseDay[cKey] || []).push(s);
    (byFacultyDay[fKey] = byFacultyDay[fKey] || []).push(s);
  }

  for (const key in byCourseDay) {
    const periods = byCourseDay[key]
      .map((s) => [s.periodStart, s.periodEnd])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < periods.length; i++) {
      const gap = periods[i][0] - periods[i - 1][1] - 1;
      if (gap > 0) penalty += gap;
    }
  }

  for (const key in byFacultyDay) {
    const periods = byFacultyDay[key]
      .map((s) => [s.periodStart, s.periodEnd])
      .sort((a, b) => a[0] - b[0]);
    let streak = 1;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i][0] === periods[i - 1][1] + 1) {
        streak++;
        if (streak >= 3) penalty += 2;
      } else {
        streak = 1;
      }
    }
  }

  return penalty;
}

module.exports = {
  buildVariables,
  buildDomain,
  isValidPlacement,
  solve,
  scoreSchedule,
  DAYS,
  PERIODS_PER_DAY,
};
