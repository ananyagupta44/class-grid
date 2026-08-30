"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "next/navigation";

const TimetableContext = createContext(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const PERIODS = [
  {
    id: "p1",
    label: "09:00 - 09:50",
    isBreak: false,
  },
  {
    id: "p2",
    label: "10:00 - 10:50",
    isBreak: false,
  },
  {
    id: "p3",
    label: "11:00 - 11:50",
    isBreak: false,
  },
  {
    id: "p4",
    label: "12:00 - 12:50",
    isBreak: false,
  },
  {
    id: "p5",
    label: "01:00 - 01:50",
    isBreak: false,
  },
  {
    id: "p6",
    label: "02:00 - 02:50",
    isBreak: false,
  },
  {
    id: "p7",
    label: "03:00 - 03:50",
    isBreak: false,
  },
  {
    id: "p8",
    label: "04:00 - 04:50",
    isBreak: false,
  },
  {
    id: "p9",
    label: "05:00 - 05:50",
    isBreak: false,
  },
];

async function apiRequest(endpoint, options = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const url = `${API_URL}${endpoint}`;

  console.log("API REQUEST:", url);
  console.log("TOKEN EXISTS:", Boolean(token));

  const response = await fetch(url, {
    ...options,

    headers: {
      "Content-Type": "application/json",

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),

      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text,
    };
  }

  console.log("API RESPONSE:", {
    url,
    status: response.status,
    statusText: response.statusText,
    data,
  });

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `HTTP ${response.status}: ${response.statusText}`,
    );
  }

  return data;
}

// ==================================================
// ID HELPER
// ==================================================

function idOf(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  return value._id || value.id || "";
}

// ==================================================
// NORMALIZE COURSE
// ==================================================

function normalizeCourse(course) {
  if (!course) return null;

  return {
    id: course._id,

    code: course.courseId,

    name: course.courseId,

    semester: course.semester,

    noOfStudents: course.noOfStudents,

    sessionId: idOf(course.session),

    session: course.session,

    subjects: course.subjects || [],
  };
}

// ==================================================
// NORMALIZE FACULTY
// ==================================================

function normalizeFaculty(faculty) {
  if (!faculty) return null;

  return {
    id: faculty._id,

    facultyId: faculty.facultyId,

    name: faculty.name,

    designation: faculty.designation,

    noOfClassesPerWeek: faculty.noOfClassesPerWeek,

    subjects: faculty.subjects || [],
  };
}

// ==================================================
// NORMALIZE VENUE
// ==================================================

function normalizeVenue(room) {
  if (!room) return null;

  return {
    id: room._id,

    name: room.roomNo,

    roomNo: room.roomNo,

    capacity: room.capacity,

    type: room.type,

    category: room.category,
  };
}

// ==================================================
// NORMALIZE ENTRY
// ==================================================

function normalizeEntry(entry) {
  return {
    id: entry._id,
    day: entry.day,
    periodId: entry.periodId,

    duration: entry.duration || 1,

    courseId: idOf(entry.course),
    subjectId: idOf(entry.subject),
    facultyId: idOf(entry.faculty),
    venueId: idOf(entry.venue),

    course: entry.course,
    subject: entry.subject,
    faculty: entry.faculty,
    venue: entry.venue,
    session: entry.session,
  };
}

// ==================================================
// PROVIDER
// ==================================================

export function TimetableProvider({ children }) {
  const searchParams = useSearchParams();

  const selectedCourseId = searchParams.get("courseId");

  const [course, setCourse] = useState(null);

  const [courses, setCourses] = useState([]);

  const [faculties, setFaculties] = useState([]);

  const [venues, setVenues] = useState([]);

  const [entries, setEntries] = useState([]);

  const [legend, setLegend] = useState([]);

  const [days, setDays] = useState(DAYS);

  const [periods, setPeriods] = useState(PERIODS);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // ==================================================
  // LOAD DASHBOARD
  // ==================================================

  async function loadDashboard() {
    if (!selectedCourseId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(`/dashboard/${selectedCourseId}`);

      console.log("FULL DASHBOARD RESPONSE:", response);

      console.log("COURSE SUBJECTS:", response.course?.subjects || []);

      console.log("LEGEND:", response.legend || []);

      // COURSE
      setCourses([normalizeCourse(response.course)]);

      // FACULTIES
      setFaculties((response.faculties || []).map(normalizeFaculty));

      // VENUES
      setVenues((response.venues || []).map(normalizeVenue));

      // ENTRIES
      setEntries((response.entries || []).map(normalizeEntry));

      setLegend(response.legend || []);
    } catch (err) {
      console.error("LOAD DASHBOARD:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadDashboard();
  }, [selectedCourseId]);

  // ==================================================
  // ADD ENTRY
  // ==================================================

  async function addEntry(form) {
    try {
      const response = await apiRequest("/timetable", {
        method: "POST",

        body: JSON.stringify({
          courseId: form.courseId,
          subjectId: form.subjectId,
          facultyId: form.facultyId,
          venueId: form.venueId,
          day: form.day,
          periodId: form.periodId,
          duration: form.duration || 1,
        }),
      });

      await loadDashboard();

      return {
        ok: true,
        entry: response.entry,
      };
    } catch (err) {
      console.error("ADD ENTRY:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  // ==================================================
  // UPDATE ENTRY
  // ==================================================

  async function updateEntry(id, form) {
    try {
      const response = await apiRequest(`/timetable/${id}`, {
        method: "PUT",

        body: JSON.stringify({
          courseId: form.courseId,
          facultyId: form.facultyId,
          venueId: form.venueId,
          day: form.day,
          periodId: form.periodId,
          duration: form.duration || 1,
        }),
      });

      const updated = normalizeEntry(response.entry);

      setEntries((previous) =>
        previous.map((entry) => (entry.id === id ? updated : entry)),
      );

      await loadDashboard();

      return {
        ok: true,
        entry: updated,
      };
    } catch (err) {
      console.error("UPDATE ENTRY:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  // ==================================================
  // DELETE ENTRY
  // ==================================================

  async function deleteEntry(id) {
    try {
      await apiRequest(`/timetable/${id}`, {
        method: "DELETE",
      });

      setEntries((previous) => previous.filter((entry) => entry.id !== id));

      await loadDashboard();

      return {
        ok: true,
      };
    } catch (err) {
      console.error("DELETE ENTRY:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  // ==================================================
  // MOVE ENTRY
  // ==================================================

  async function moveEntry(id, day, periodId) {
    const existing = entries.find((entry) => entry.id === id);

    if (!existing) {
      return {
        ok: false,
        reason: "Class not found.",
      };
    }

    return updateEntry(id, {
      courseId: existing.courseId,

      facultyId: existing.facultyId,

      venueId: existing.venueId,

      day,

      periodId,
    });
  }

  // ==================================================
  // REFRESH
  // ==================================================

  async function refresh() {
    await loadDashboard();
  }

  // ==================================================
  // CONTEXT VALUE
  // ==================================================

  const value = {
    days,

    periods,

    courses,

    faculties,

    venues,

    entries,

    legend,

    currentCourse: course,

    selectedCourseId,

    loading,

    error,

    addEntry,

    updateEntry,

    deleteEntry,

    moveEntry,

    refresh,
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
}

// ==================================================
// HOOK
// ==================================================

export function useTimetable() {
  const context = useContext(TimetableContext);

  if (!context) {
    throw new Error("useTimetable must be used inside TimetableProvider");
  }

  return context;
}
