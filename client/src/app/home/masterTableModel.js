/*
 * Data for the Master Table (faculty-allocation sheet).
 *
 * One GROUP per course, one ROW per subject of that course:
 *   S.No. | Course | Sem | Type | Code | Title | L | T | P | Credits |
 *   Faculty | Students | Lab venue | Combined class
 *
 * "Lab venue" and "Combined class" are worked out from the scheduled
 * timetable entries, so they fill in by themselves once classes exist.
 */

export const idOf = (value) =>
  value && typeof value === "object" ? value._id || value.id : value;

const natural = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const isLabRoom = (room) => /lab/i.test(room?.type || "");

const round2 = (n) => Math.round(n * 100) / 100;

export function buildMasterModel({
  courses = [],
  subjects = [],
  faculty = [],
  entries = [],
}) {
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const facultyById = new Map(faculty.map((f) => [String(f._id), f]));

  // ---- facts from the timetable: lab venues + combined classes ----
  const comboCourses = new Map(); // comboGroupId -> Set(courseId labels)
  const labVenues = new Map(); // courseDbId|subjectDbId -> Set(roomNo)
  const combinedWith = new Map(); // courseDbId|subjectDbId -> Set(courseId labels)

  const courseLabel = (value) =>
    typeof value === "object" && value
      ? value.courseId
      : courses.find((c) => String(c._id) === String(value))?.courseId;

  for (const entry of entries) {
    if (entry.comboGroupId) {
      const set = comboCourses.get(entry.comboGroupId) || new Set();
      const label = courseLabel(entry.course);
      if (label) set.add(label);
      comboCourses.set(entry.comboGroupId, set);
    }
  }

  for (const entry of entries) {
    const key = `${idOf(entry.course)}|${idOf(entry.subject)}`;

    if (isLabRoom(entry.venue) && entry.venue?.roomNo) {
      const set = labVenues.get(key) || new Set();
      set.add(String(entry.venue.roomNo));
      labVenues.set(key, set);
    }

    if (entry.comboGroupId) {
      const mine = courseLabel(entry.course);
      const set = combinedWith.get(key) || new Set();

      for (const label of comboCourses.get(entry.comboGroupId) || []) {
        if (label !== mine) set.add(label);
      }

      combinedWith.set(key, set);
    }
  }

  // ---- one group per course ----
  return [...courses]
    .sort(
      (a, b) =>
        (Number(a.semester) || 0) - (Number(b.semester) || 0) ||
        natural(a.courseId, b.courseId),
    )
    .map((course) => {
      const items = Array.isArray(course.subjects) ? course.subjects : [];

      const rows = items.map((item, index) => {
        const subjectDbId = String(idOf(item.subject) || "");

        const subject =
          subjectById.get(subjectDbId) ||
          (typeof item.subject === "object" ? item.subject : null) ||
          {};

        const facultyDbId = idOf(item.faculty) ? String(idOf(item.faculty)) : "";

        const teacher = facultyDbId
          ? facultyById.get(facultyDbId) ||
            (typeof item.faculty === "object" ? item.faculty : null)
          : null;

        const ltp = Array.isArray(subject.ltp) ? subject.ltp : [];
        const key = `${course._id}|${subjectDbId}`;

        const credits = Number(subject.credits);

        return {
          key,
          sNo: index + 1,
          subjectDbId,
          code: subject.subjectId || "",
          title: subject.name || "",
          type: subject.type === "lab" ? "Lab" : "Theory",
          elective: String(subject.category || "").toLowerCase() === "elective",
          l: ltp[0] ?? 0,
          t: ltp[1] ?? 0,
          p: ltp[2] ?? 0,
          credits: Number.isFinite(credits) ? credits : null,
          facultyDbId,
          facultyName: teacher?.name || "",
          facultyCode: teacher?.facultyId || "",
          labVenues: [...(labVenues.get(key) || [])].sort(natural),
          combinedWith: [...(combinedWith.get(key) || [])].sort(natural),
        };
      });

      return {
        id: String(course._id),
        course,
        courseId: course.courseId,
        semester: course.semester,
        students: course.noOfStudents,
        rows,
        totalCredits: round2(rows.reduce((sum, row) => sum + (row.credits || 0), 0)),
      };
    });
}

/*
 * Search across course, code, title, faculty and venues.
 * A course whose own name matches keeps all its subjects.
 * With no query every group is kept (even empty courses, so they can get
 * their first subject); with a query only groups with a match remain.
 */
export function filterMasterModel(groups, query) {
  const q = String(query || "").trim().toLowerCase();

  if (!q) return groups.map((group) => ({ ...group, visibleRows: group.rows }));

  const result = [];

  for (const group of groups) {
    const courseMatches = `${group.courseId} sem ${group.semester}`
      .toLowerCase()
      .includes(q);

    const visibleRows = courseMatches
      ? group.rows
      : group.rows.filter((row) =>
          [
            row.code,
            row.title,
            row.type,
            row.facultyName,
            row.facultyCode,
            row.labVenues.join(" "),
            row.combinedWith.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );

    if (visibleRows.length) result.push({ ...group, visibleRows });
  }

  return result;
}
