/*
 * ROLES & PERMISSIONS — the one place that decides who may do what.
 *
 *   1. student        view course + venue timetables
 *   2. faculty        student  + view their OWN faculty timetable
 *   3. dept_incharge  faculty  + add course, add faculty, add subjects,
 *                              assign faculty to subjects
 *   4. admin          dept_incharge + edit timetables           ("TT team")
 *   5. super_admin    everything, incl. venues / sessions / accounts
 *
 * Each level includes everything below it. To change who can do something,
 * edit the line for that permission — routes and the website both read this.
 * (The website keeps an identical copy in context/permissions.js.)
 */

export const ROLES = [
  "student",
  "faculty",
  "dept_incharge",
  "admin",
  "super_admin",
];

export const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  dept_incharge: "Dept. In-charge",
  admin: "Admin (TT team)",
  super_admin: "Super Admin",
};

// accounts created before the five levels existed
const LEGACY_ROLES = { staff: "faculty" };

export const normalizeRole = (role) =>
  LEGACY_ROLES[role] || (ROLES.includes(role) ? role : null);

// the role itself and every role above it
const from = (role) => ROLES.slice(ROLES.indexOf(role));

export const PERMISSIONS = {
  // ---- viewing ----
  viewCourseTT: from("student"),
  viewVenueTT: from("student"),
  viewOwnFacultyTT: from("faculty"),

  // Assumption: the TT team needs every faculty's schedule to build clash-free
  // timetables. Change to from("super_admin") to restrict it.
  viewAllFacultyTT: from("admin"),

  // ---- department setup (dept. in-charge and above) ----
  accessHome: from("dept_incharge"),
  addCourse: from("dept_incharge"),
  addFaculty: from("dept_incharge"),
  viewFacultyList: from("dept_incharge"),
  addSubject: from("dept_incharge"),
  addSubjectToCourse: from("dept_incharge"),
  assignFaculty: from("dept_incharge"),

  // ---- timetable work (TT team and above) ----
  editTimetable: from("admin"),
  generateTimetable: from("admin"),

  // ---- institute-level data and accounts (super admin only) ----
  addRoom: ["super_admin"],
  addSession: ["super_admin"],
  manageAccounts: ["super_admin"],
};

export const can = (role, permission) =>
  Boolean(PERMISSIONS[permission]?.includes(normalizeRole(role)));
