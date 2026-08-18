"use client";

import { createContext, useContext, useMemo, useState } from "react";

const TimetableContext = createContext(null);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [
  { id: "p1", label: "09:00" },
  { id: "p2", label: "10:00" },
  { id: "p3", label: "11:00" },
  { id: "p4", label: "12:00" },
  { id: "p5", label: "14:00" },
  { id: "p6", label: "15:00" },
];

const initialFaculties = [
  { id: "f1", name: "Dr. Priya Sharma", dept: "CSE", email: "priya@college.edu" },
  { id: "f2", name: "Dr. Rahul Mehta", dept: "CSE", email: "rahul@college.edu" },
  { id: "f3", name: "Dr. Neha Singh", dept: "Mathematics", email: "neha@college.edu" },
];

const initialVenues = [
  { id: "v1", name: "Room 204", type: "Classroom", capacity: 60 },
  { id: "v2", name: "Lab 3", type: "Computer Lab", capacity: 40 },
  { id: "v3", name: "Room 112", type: "Classroom", capacity: 60 },
];

const initialCourses = [
  {
    id: "c1",
    code: "BTECH3A",
    semester: "3",
    session: "Monsoon",
    subjects: [
      { id: "s1", name: "DSA" },
      { id: "s2", name: "DBMS" },
      { id: "s3", name: "Mathematics" },
    ],
    assignments: [
      { id: "a1", subjectId: "s1", facultyId: "f1", l: 3, t: 0, p: 1 },
      { id: "a2", subjectId: "s2", facultyId: "f2", l: 3, t: 0, p: 1 },
      { id: "a3", subjectId: "s3", facultyId: "f3", l: 3, t: 1, p: 0 },
    ],
  },
  {
    id: "c2",
    code: "BCA5",
    semester: "5",
    session: "Monsoon",
    subjects: [
      { id: "s4", name: "Web Technology" },
      { id: "s5", name: "AI Fundamentals" },
    ],
    assignments: [
      { id: "a4", subjectId: "s4", facultyId: "f1", l: 3, t: 0, p: 1 },
      { id: "a5", subjectId: "s5", facultyId: "f2", l: 3, t: 0, p: 0 },
    ],
  },
  {
    id: "c3",
    code: "BTECH7A",
    semester: "7",
    session: "Spring",
    subjects: [
      { id: "s6", name: "Cloud Computing" },
      { id: "s7", name: "Machine Learning" },
    ],
    assignments: [
      { id: "a6", subjectId: "s6", facultyId: "f2", l: 3, t: 0, p: 1 },
      { id: "a7", subjectId: "s7", facultyId: "f1", l: 3, t: 0, p: 1 },
    ],
  },
];

const initialBlocks = [
  { id: "b1", courseId: "c1", subjectId: "s1", facultyId: "f1", kind: "L", venueId: "v1", day: "Mon", periodId: "p1" },
  { id: "b2", courseId: "c1", subjectId: "s2", facultyId: "f2", kind: "L", venueId: "v2", day: "Mon", periodId: "p2" },
  { id: "b3", courseId: "c1", subjectId: "s3", facultyId: "f3", kind: "L", venueId: "v3", day: "Tue", periodId: "p3" },
  { id: "b4", courseId: "c1", subjectId: "s1", facultyId: "f1", kind: "P", venueId: "v2", day: "Wed", periodId: "p5" },
];

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function TimetableProvider({ children }) {
  const [days] = useState(DAYS);
  const [periods] = useState(PERIODS);
  const [courses, setCourses] = useState(initialCourses);
  const [faculties, setFaculties] = useState(initialFaculties);
  const [venues, setVenues] = useState(initialVenues);
  const [classBlocks, setClassBlocks] = useState(initialBlocks);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0]?.id ?? "");

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  function addCourse(payload) {
    const subjects = (payload.subjects || [])
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: uid("subject"), name }));

    if (!payload.code?.trim() || !payload.semester?.trim() || !subjects.length) {
      return { ok: false, reason: "Course, semester and at least one subject are required." };
    }

    const course = {
      id: uid("course"),
      code: payload.code.trim().toUpperCase(),
      semester: payload.semester.trim(),
      session: payload.session || "Monsoon",
      subjects,
      assignments: [],
    };

    setCourses((prev) => [...prev, course]);
    setSelectedCourseId(course.id);
    return { ok: true, course };
  }

  function removeCourse(id) {
    setCourses((prev) => prev.filter((course) => course.id !== id));
    setClassBlocks((prev) => prev.filter((block) => block.courseId !== id));
    setSelectedCourseId((prev) => {
      if (prev !== id) return prev;
      const remaining = courses.filter((course) => course.id !== id);
      return remaining[0]?.id ?? "";
    });
  }

  function addFaculty(payload) {
    if (!payload.name?.trim()) return { ok: false, reason: "Faculty name is required." };
    const faculty = { id: uid("faculty"), ...payload, name: payload.name.trim() };
    setFaculties((prev) => [...prev, faculty]);
    return { ok: true, faculty };
  }

  function removeFaculty(id) {
    setFaculties((prev) => prev.filter((faculty) => faculty.id !== id));
  }

  function addVenue(payload) {
    if (!payload.name?.trim()) return { ok: false, reason: "Venue name is required." };
    const venue = {
      id: uid("venue"),
      ...payload,
      name: payload.name.trim(),
      capacity: Number(payload.capacity) || 0,
    };
    setVenues((prev) => [...prev, venue]);
    return { ok: true, venue };
  }

  function removeVenue(id) {
    setVenues((prev) => prev.filter((venue) => venue.id !== id));
    setClassBlocks((prev) =>
      prev.map((block) => (block.venueId === id ? { ...block, venueId: null, day: null, periodId: null } : block)),
    );
  }

  function addSubject(courseId, name) {
    if (!name?.trim()) return { ok: false, reason: "Subject name is required." };

    const subject = { id: uid("subject"), name: name.trim() };
    setCourses((prev) =>
      prev.map((course) =>
        course.id === courseId ? { ...course, subjects: [...course.subjects, subject] } : course,
      ),
    );
    return { ok: true, subject };
  }

  function upsertAssignment(courseId, subjectId, payload) {
    if (!payload.facultyId) return { ok: false, reason: "Select a faculty member." };

    setCourses((prev) =>
      prev.map((course) => {
        if (course.id !== courseId) return course;

        const assignment = {
          id: course.assignments.find((item) => item.subjectId === subjectId)?.id ?? uid("assignment"),
          subjectId,
          facultyId: payload.facultyId,
          l: Math.max(0, Number(payload.l) || 0),
          t: Math.max(0, Number(payload.t) || 0),
          p: Math.max(0, Number(payload.p) || 0),
        };

        const exists = course.assignments.some((item) => item.subjectId === subjectId);
        return {
          ...course,
          assignments: exists
            ? course.assignments.map((item) => (item.subjectId === subjectId ? assignment : item))
            : [...course.assignments, assignment],
        };
      }),
    );

    return { ok: true };
  }

  function addClassBlock(courseId, subjectId, facultyId, kind) {
    const block = {
      id: uid("block"),
      courseId,
      subjectId,
      facultyId,
      kind,
      venueId: null,
      day: null,
      periodId: null,
    };

    setClassBlocks((prev) => [...prev, block]);
    return { ok: true, block };
  }

  function generateAssignmentBlocks(courseId, subjectId, facultyId, counts) {
    const l = Math.max(0, Number(counts.l) || 0);
    const t = Math.max(0, Number(counts.t) || 0);
    const p = Math.max(0, Number(counts.p) || 0);

    const blocks = [
      ...Array.from({ length: l }, () => "L"),
      ...Array.from({ length: t }, () => "T"),
      ...Array.from({ length: p }, () => "P"),
    ].map((kind) => ({
      id: uid("block"),
      courseId,
      subjectId,
      facultyId,
      kind,
      venueId: null,
      day: null,
      periodId: null,
    }));

    setClassBlocks((prev) => [
      ...prev.filter(
        (block) =>
          !(block.courseId === courseId && block.subjectId === subjectId && !block.venueId),
      ),
      ...blocks,
    ]);

    return { ok: true, count: blocks.length };
  }

  function assignClassBlock(blockId, venueId, day, periodId) {
    const targetOccupied = classBlocks.some(
      (block) =>
        block.venueId === venueId &&
        block.day === day &&
        block.periodId === periodId &&
        block.id !== blockId,
    );

    if (targetOccupied) {
      return { ok: false, reason: "That venue is already occupied in this slot." };
    }

    const block = classBlocks.find((item) => item.id === blockId);
    if (!block) return { ok: false, reason: "Class block not found." };

    const facultyOccupied = classBlocks.some(
      (item) =>
        item.id !== blockId &&
        item.facultyId === block.facultyId &&
        item.day === day &&
        item.periodId === periodId,
    );

    if (facultyOccupied) {
      return { ok: false, reason: "That faculty member already has a class in this slot." };
    }

    const courseOccupied = classBlocks.some(
      (item) =>
        item.id !== blockId &&
        item.courseId === block.courseId &&
        item.day === day &&
        item.periodId === periodId,
    );

    if (courseOccupied) {
      return { ok: false, reason: "This course already has a class in this slot." };
    }

    setClassBlocks((prev) =>
      prev.map((item) =>
        item.id === blockId
          ? { ...item, venueId, day, periodId }
          : item,
      ),
    );

    return { ok: true };
  }

  function unassignClassBlock(blockId) {
    setClassBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId ? { ...block, venueId: null, day: null, periodId: null } : block,
      ),
    );
  }

  function moveClassBlock(blockId, day, periodId) {
    const block = classBlocks.find((item) => item.id === blockId);
    if (!block?.venueId) return { ok: false, reason: "Assign a venue first." };
    return assignClassBlock(blockId, block.venueId, day, periodId);
  }

  const value = useMemo(
    () => ({
      days,
      periods,
      courses,
      faculties,
      venues,
      classBlocks,
      selectedCourse,
      selectedCourseId,
      setSelectedCourseId,
      addCourse,
      removeCourse,
      addFaculty,
      removeFaculty,
      addVenue,
      removeVenue,
      addSubject,
      upsertAssignment,
      addClassBlock,
      generateAssignmentBlocks,
      assignClassBlock,
      unassignClassBlock,
      moveClassBlock,
    }),
    [
      days,
      periods,
      courses,
      faculties,
      venues,
      classBlocks,
      selectedCourse,
      selectedCourseId,
    ],
  );

  return <TimetableContext.Provider value={value}>{children}</TimetableContext.Provider>;
}

export function useTimetable() {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error("useTimetable must be used inside a TimetableProvider");
  }
  return context;
}
