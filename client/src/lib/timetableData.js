// lib/timetableData.js
// Seed data for the timetable generator. Swap these arrays for real API
// responses once the backend is ready — the shape is what the context expects.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 50-minute periods back to back, 9:00 to 5:50, matching the college's
// actual slotting. (The 10-minute gap between periods is real time but
// isn't shown as its own column, same as the printed timetable.)
function buildPeriods() {
  const periods = [];
  let startMinutes = 9 * 60; // 9:00
  for (let i = 1; i <= 9; i++) {
    const start = startMinutes;
    const end = start + 50;
    periods.push({
      id: `p${i}`,
      label: `${formatTime(start)}\u2013${formatTime(end)}`,
    });
    startMinutes = end + 10; // 10-minute gap before the next period
  }
  return periods;
}

function formatTime(totalMinutes) {
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")}`;
}

export const PERIODS = buildPeriods();

// periodsPerWeek is how many sessions this course needs placed on the grid
// each week (its "L" — lecture hours/week). facultyId is who primarily
// teaches it, used to group the legend by faculty.
export const INITIAL_COURSES = [
  {
    id: "c1",
    code: "DSA",
    name: "Data Structures",
    semester: "3rd",
    periodsPerWeek: 3,
    facultyId: "f1",
  },
  {
    id: "c2",
    code: "OS",
    name: "Operating Systems",
    semester: "3rd",
    periodsPerWeek: 3,
    facultyId: "f2",
  },
  {
    id: "c3",
    code: "DBMS",
    name: "Database Systems",
    semester: "3rd",
    periodsPerWeek: 3,
    facultyId: "f3",
  },
  {
    id: "c4",
    code: "CN",
    name: "Computer Networks",
    semester: "3rd",
    periodsPerWeek: 2,
    facultyId: "f4",
  },
];

export const INITIAL_FACULTIES = [
  {
    id: "f1",
    name: "Prof. Mehta",
    dept: "Computer Science",
    email: "mehta@college.edu",
  },
  {
    id: "f2",
    name: "Dr. Rao",
    dept: "Computer Science",
    email: "rao@college.edu",
  },
  {
    id: "f3",
    name: "Dr. Iyer",
    dept: "Computer Science",
    email: "iyer@college.edu",
  },
  {
    id: "f4",
    name: "Prof. Sharma",
    dept: "Computer Science",
    email: "sharma@college.edu",
  },
];

export const INITIAL_VENUES = [
  { id: "v1", name: "R101", capacity: 60, type: "Classroom" },
  { id: "v2", name: "Lab 2", capacity: 40, type: "Lab" },
  { id: "v3", name: "R204", capacity: 70, type: "Classroom" },
  { id: "v4", name: "Lab 1", capacity: 40, type: "Lab" },
];

// entries link a course + faculty + venue to a day/period slot.
export const INITIAL_ENTRIES = [
  {
    id: "e1",
    day: "Mon",
    periodId: "p1",
    courseId: "c1",
    facultyId: "f1",
    venueId: "v1",
  },
  {
    id: "e2",
    day: "Mon",
    periodId: "p4",
    courseId: "c2",
    facultyId: "f2",
    venueId: "v2",
  },
  {
    id: "e3",
    day: "Tue",
    periodId: "p2",
    courseId: "c3",
    facultyId: "f3",
    venueId: "v3",
  },
  {
    id: "e4",
    day: "Wed",
    periodId: "p1",
    courseId: "c1",
    facultyId: "f1",
    venueId: "v1",
  },
  {
    id: "e5",
    day: "Thu",
    periodId: "p6",
    courseId: "c4",
    facultyId: "f4",
    venueId: "v1",
  },
  {
    id: "e6",
    day: "Fri",
    periodId: "p4",
    courseId: "c3",
    facultyId: "f3",
    venueId: "v4",
  },
];
