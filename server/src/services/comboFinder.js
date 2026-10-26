import mongoose from "mongoose";

import Combo from "../models/Combo.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";

import { checkVenueType, labProfile } from "../utils/labRooms.js";

const MAX_MEMBERS = 12; // same limit as the manual "Create combo"

const ltpKey = (subject) =>
  [0, 1, 2].map((i) => Number(subject?.ltp?.[i]) || 0).join("-");

// "Data Structures & Algorithms" and "data structures algorithms" count as the same name
const normName = (subject) =>
  String(subject?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const students = (member) => Number(member.course.noOfStudents) || 0;

/*
 * Finds which (course, subject) pairs of ONE session can be taught together.
 * It uses the same rules as the manual createCombo:
 *   - same faculty
 *   - same L-T-P hours
 *   - not lab mixed with theory
 *   - each course only once in a combo
 *   - not already inside another combo
 * plus: all students together must fit in at least one suitable room.
 *
 * matchBy = "name" (default): subject names must match too (DSA in sem 5 and
 *                             sem 7 with different codes still match).
 * matchBy = "any":            any subjects of the same faculty with the same
 *                             L-T-P can be combined (more combos, less safe).
 */
export function findComboCandidates({
  courses,
  subjects,
  faculties = [],
  rooms,
  existingCombos = [],
  matchBy = "name",
}) {
  const subjById = new Map(subjects.map((s) => [String(s._id), s]));
  const facById = new Map(faculties.map((f) => [String(f._id), f]));

  const taken = new Set();

  for (const combo of existingCombos) {
    for (const m of combo.members || []) taken.add(`${m.course}|${m.subject}`);
  }

  // 1. group the pairs
  const groups = new Map();

  for (const course of courses) {
    for (const entry of course.subjects || []) {
      const subject = subjById.get(String(entry.subject));

      if (!subject || !entry.faculty) continue;
      if (taken.has(`${course._id}|${subject._id}`)) continue;

      const key = [
        String(entry.faculty),
        ltpKey(subject),
        labProfile(subject).labOnly ? "lab" : "theory",
        matchBy === "any" ? "" : normName(subject),
      ].join("|");

      if (!groups.has(key)) groups.set(key, []);

      groups.get(key).push({ course, subject, faculty: String(entry.faculty) });
    }
  }

  const fits = (members) => {
    const total = members.reduce((t, m) => t + students(m), 0);

    return rooms.some(
      (room) =>
        (!total || room.capacity >= total) &&
        members.every((m) => checkVenueType(m.subject, room, rooms).ok),
    );
  };

  const candidates = [];
  const skipped = [];

  // 2. inside each group, build combos
  for (const pairs of groups.values()) {
    // each course may appear only once in a combo, so split into "layers"
    const byCourse = new Map();

    for (const pair of pairs) {
      const id = String(pair.course._id);

      if (!byCourse.has(id)) byCourse.set(id, []);

      byCourse.get(id).push(pair);
    }

    while ([...byCourse.values()].some((list) => list.length)) {
      const layer = [];

      for (const list of byCourse.values()) {
        if (list.length) layer.push(list.shift());
      }

      if (layer.length < 2) continue;

      // put courses into rooms-sized groups, biggest course first
      const bins = [];

      for (const member of [...layer].sort((a, b) => students(b) - students(a))) {
        const bin = bins.find(
          (b) => b.length < MAX_MEMBERS && fits([...b, member]),
        );

        if (bin) bin.push(member);
        else bins.push([member]);
      }

      for (const members of bins) {
        if (members.length < 2) {
          const m = members[0];

          skipped.push(
            `${m.course.courseId} / ${m.subject.subjectId || m.subject.name}: no room is big enough to combine it with the other courses`,
          );

          continue;
        }

        members.sort(
          (a, b) =>
            (Number(a.course.semester) || 0) - (Number(b.course.semester) || 0) ||
            String(a.course.courseId).localeCompare(String(b.course.courseId), undefined, { numeric: true }),
        );

        const faculty = facById.get(members[0].faculty);

        const name = [...new Set(members.map((m) => m.subject.subjectId || m.subject.name))].join(" + ");

        candidates.push({
          combo: {
            _id: new mongoose.Types.ObjectId(),
            session: members[0].course.session,
            name,
            faculty: members[0].faculty,
            members: members.map((m) => ({
              course: m.course._id,
              subject: m.subject._id,
            })),
          },
          summary: {
            name,
            faculty: faculty?.name || members[0].faculty,
            ltp: ltpKey(members[0].subject),
            totalStudents: members.reduce((t, m) => t + students(m), 0),
            courses: members.map((m) => ({
              courseId: m.course.courseId,
              semester: m.course.semester,
              subjectCode: m.subject.subjectId,
              subjectName: m.subject.name,
              students: students(m),
            })),
          },
        });
      }
    }
  }

  candidates.sort((a, b) => a.summary.name.localeCompare(b.summary.name));

  return { candidates, skipped };
}

// loads one session from the database and finds its combos (nothing is saved here)
export async function suggestCombosForSession(sessionId, matchBy = "name") {
  const courses = await Course.find({ session: sessionId })
    .sort({ semester: 1, courseId: 1 })
    .lean();

  const subjectIds = [
    ...new Set(courses.flatMap((c) => c.subjects.map((s) => String(s.subject)))),
  ];

  const facultyIds = [
    ...new Set(
      courses.flatMap((c) => c.subjects.map((s) => s.faculty).filter(Boolean).map(String)),
    ),
  ];

  const [subjects, faculties, rooms, existingCombos] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds } }).lean(),
    Faculty.find({ _id: { $in: facultyIds } }).lean(),
    Room.find().lean(),
    Combo.find({ session: sessionId }).lean(),
  ]);

  return findComboCandidates({
    courses,
    subjects,
    faculties,
    rooms,
    existingCombos,
    matchBy: matchBy === "any" ? "any" : "name",
  });
}
