import mongoose from "mongoose";
import ExcelJS from "exceljs";

import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Faculty from "../models/Faculty.js";
import Session from "../models/Session.js";
import TimetableEntry from "../models/TimetableEntry.js";
import { can } from "../utils/permissions.js";

/*
 * MASTER TABLE <-> EXCEL
 *
 *   GET  /api/master-table/template            blank sheet to fill in
 *   GET  /api/master-table/export?sessionId=   the master table as it is now
 *   POST /api/master-table/import?sessionId=   upload a filled sheet (raw .xlsx body)
 *
 * The exported sheet uses the same column headings as the template, so an
 * exported file can be edited and imported back. Columns the import does not
 * know (S.No., Faculty, Lab venue, Combined class) are simply ignored.
 *
 * Import is all-or-nothing on VALIDATION: every row is checked first, and if
 * anything is wrong nothing is saved and the row-wise problems are returned.
 * Saves go through the normal models, so the audit log records them.
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SHEET = "Master Table";
const MAX_ERRORS_RETURNED = 100;

// header text + the names we also accept for it (compared in lower-case, letters/digits only)
const COLUMNS = [
  { key: "course", header: "Course", width: 14, aliases: ["course", "courseid"] },
  { key: "semester", header: "Sem", width: 7, aliases: ["sem", "semester"] },
  { key: "students", header: "Students", width: 10, aliases: ["students", "noofstudents"] },
  { key: "type", header: "Type", width: 10, aliases: ["type"] },
  { key: "code", header: "Course code", width: 14, aliases: ["coursecode", "code", "subjectcode", "subjectid"] },
  { key: "title", header: "Course title", width: 36, aliases: ["coursetitle", "title", "subjectname", "subjecttitle", "name"] },
  { key: "l", header: "L", width: 5, aliases: ["l"] },
  { key: "t", header: "T", width: 5, aliases: ["t"] },
  { key: "p", header: "P", width: 5, aliases: ["p"] },
  { key: "credits", header: "Credits", width: 9, aliases: ["credits", "totalcredits"] },
  { key: "category", header: "Category", width: 11, aliases: ["category"] },
  { key: "facultyId", header: "Faculty ID", width: 12, aliases: ["facultyid", "facultycode"] },
];

const natural = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const thin = { style: "thin", color: { argb: "FFD9CFB8" } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const dark = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C2B26" } };

function styleHeader(ws) {
  const head = ws.getRow(1);

  head.height = 20;
  head.alignment = { vertical: "middle" };
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = dark;
  });
}

async function sendWorkbook(wb, res, filename) {
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// =====================================================================
//  TEMPLATE
// =====================================================================
export const downloadTemplate = async (req, res) => {
  try {
    const [faculty, subjects] = await Promise.all([
      Faculty.find().sort({ name: 1 }).lean(),
      Subject.find().sort({ subjectId: 1 }).lean(),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "ClassGrid";

    // ----- sheet 1: the sheet to fill in -----
    const ws = wb.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    styleHeader(ws);

    // dropdowns for Type (column D) and Category (column K)
    for (let r = 2; r <= 500; r++) {
      ws.getCell(`D${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Theory,Lab"'],
      };
      ws.getCell(`K${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Course,Elective"'],
      };
    }

    // ----- sheet 2: how to fill it -----
    const help = wb.addWorksheet("Instructions");
    help.columns = [{ width: 18 }, { width: 95 }];

    const lines = [
      ["How to use", "Fill the 'Master Table' sheet - one row per subject of a course - and upload it with Import."],
      ["Course", "Course ID, e.g. BTECH-CSE-A. A course that does not exist yet is created in the selected session."],
      ["Sem / Students", "Required when the course is new (taken from its first row). Ignored for courses that already exist."],
      ["Type", "Theory or Lab. Needed only when the subject is new."],
      ["Course code", "Subject code, e.g. CS101. An existing code is reused as it is; a new code creates the subject (then title, Type, L, T, P and Credits are needed)."],
      ["L / T / P", "Lecture, tutorial and practical hours. Blank means 0."],
      ["Category", "Course or Elective (blank = Course). Only used when the subject is new."],
      ["Faculty ID", "Optional. Must be an ID from the 'Faculty IDs' sheet. It is assigned to that subject in that course."],
      ["Course only", "A row with just Course, Sem and Students (no Course code) creates an empty course."],
      ["If a row is wrong", "Nothing is imported. You get the row numbers and what to fix, then upload again."],
    ];

    lines.forEach(([a, b]) => {
      const row = help.addRow([a, b]);
      row.getCell(1).font = { bold: true };
      row.alignment = { vertical: "top", wrapText: true };
    });

    // ----- sheet 3 + 4: reference lists -----
    const f = wb.addWorksheet("Faculty IDs");
    f.columns = [
      { header: "Faculty ID", width: 14 },
      { header: "Name", width: 30 },
      { header: "Designation", width: 22 },
    ];
    faculty.forEach((x) => f.addRow([x.facultyId, x.name, x.designation]));
    styleHeader(f);

    const s = wb.addWorksheet("Existing subjects");
    s.columns = [
      { header: "Course code", width: 14 },
      { header: "Course title", width: 36 },
      { header: "Type", width: 10 },
      { header: "L", width: 5 },
      { header: "T", width: 5 },
      { header: "P", width: 5 },
      { header: "Credits", width: 9 },
    ];
    subjects.forEach((x) =>
      s.addRow([
        x.subjectId,
        x.name,
        x.type === "lab" ? "Lab" : "Theory",
        x.ltp?.[0] ?? 0,
        x.ltp?.[1] ?? 0,
        x.ltp?.[2] ?? 0,
        x.credits,
      ]),
    );
    styleHeader(s);

    await sendWorkbook(wb, res, "master-table-template.xlsx");
  } catch (error) {
    console.error("MASTER TEMPLATE ERROR:", error);

    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Could not create the template" });
    }
  }
};

// =====================================================================
//  EXPORT
// =====================================================================
export const exportMaster = async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "A valid sessionId is required" });
    }

    const session = await Session.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const [courses, entries] = await Promise.all([
      Course.find({ session: session._id })
        .populate("subjects.subject")
        .populate("subjects.faculty", "facultyId name")
        .lean(),
      TimetableEntry.find({ session: session._id })
        .populate("venue", "roomNo type")
        .populate("course", "courseId")
        .lean(),
    ]);

    // ---- lab venues + combined classes, worked out from the timetable ----
    const comboCourses = new Map(); // comboGroupId -> Set(courseId)
    const labVenues = new Map(); // "course|subject" -> Set(roomNo)
    const combinedWith = new Map(); // "course|subject" -> Set(courseId)

    for (const e of entries) {
      if (!e.comboGroupId || !e.course?.courseId) continue;

      const set = comboCourses.get(e.comboGroupId) || new Set();
      set.add(e.course.courseId);
      comboCourses.set(e.comboGroupId, set);
    }

    for (const e of entries) {
      const key = `${e.course?._id}|${e.subject}`;

      if (/lab/i.test(e.venue?.type || "") && e.venue?.roomNo) {
        const set = labVenues.get(key) || new Set();
        set.add(String(e.venue.roomNo));
        labVenues.set(key, set);
      }

      if (e.comboGroupId) {
        const set = combinedWith.get(key) || new Set();

        for (const label of comboCourses.get(e.comboGroupId) || []) {
          if (label !== e.course?.courseId) set.add(label);
        }

        combinedWith.set(key, set);
      }
    }

    // ---- sheet ----
    const wb = new ExcelJS.Workbook();
    wb.creator = "ClassGrid";
    wb.created = new Date();

    const ws = wb.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });

    ws.columns = [
      { header: "S.No.", key: "sNo", width: 7 },
      ...COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width })),
      { header: "Faculty", key: "facultyName", width: 26 },
      { header: "Lab venue", key: "labVenue", width: 16 },
      { header: "Combined class", key: "combined", width: 24 },
    ];

    courses.sort(
      (a, b) =>
        (Number(a.semester) || 0) - (Number(b.semester) || 0) ||
        natural(a.courseId, b.courseId),
    );

    for (const course of courses) {
      const items = (course.subjects || []).filter((i) => i.subject);

      // an empty course still gets one row, so it survives an export -> import round trip
      if (!items.length) {
        ws.addRow({
          course: course.courseId,
          semester: course.semester,
          students: course.noOfStudents,
        });
        continue;
      }

      items.forEach((item, index) => {
        const sub = item.subject;
        const key = `${course._id}|${sub._id}`;

        ws.addRow({
          sNo: index + 1,
          course: course.courseId,
          semester: course.semester,
          students: course.noOfStudents,
          type: sub.type === "lab" ? "Lab" : "Theory",
          code: sub.subjectId,
          title: sub.name,
          l: sub.ltp?.[0] ?? 0,
          t: sub.ltp?.[1] ?? 0,
          p: sub.ltp?.[2] ?? 0,
          credits: sub.credits,
          category: sub.category === "elective" ? "Elective" : "Course",
          facultyId: item.faculty?.facultyId || "",
          facultyName: item.faculty?.name || "",
          labVenue: [...(labVenues.get(key) || [])].sort(natural).join(" / "),
          combined: combinedWith.get(key)?.size
            ? `with ${[...combinedWith.get(key)].sort(natural).join(", ")}`
            : "",
        });
      });
    }

    ws.eachRow((row, n) => {
      if (n > 1) row.eachCell({ includeEmpty: true }, (c) => (c.border = border));
    });

    styleHeader(ws);
    ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };

    await sendWorkbook(wb, res, `master-table_${session.sessionId}.xlsx`);
  } catch (error) {
    console.error("MASTER EXPORT ERROR:", error);

    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Could not export the master table" });
    }
  }
};

// =====================================================================
//  IMPORT
// =====================================================================

// one Excel cell -> trimmed text (handles formulas, rich text, links, dates)
function cellText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();

  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    return "";
  }

  return String(v).trim();
}

// "" -> null, "12" -> 12, "abc" -> NaN
const toNumber = (text) => (text === "" ? null : Number(text));

async function readRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(SHEET) || wb.worksheets[0];

  if (!ws) throw new Error("The file has no sheet");

  // heading -> column number
  const columnOf = {};

  ws.getRow(1).eachCell((cell, col) => {
    const name = norm(cellText(cell.value));

    for (const c of COLUMNS) {
      if (!columnOf[c.key] && c.aliases.includes(name)) columnOf[c.key] = col;
    }
  });

  const missing = ["course", "code"].filter((key) => !columnOf[key]);

  if (missing.length) {
    const names = missing.map((k) => `'${COLUMNS.find((c) => c.key === k).header}'`);
    const error = new Error(
      `Column ${names.join(" and ")} not found in row 1. Please use the downloaded template.`,
    );
    error.status = 400;
    throw error;
  }

  const rows = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item = { row: r };

    for (const c of COLUMNS) {
      item[c.key] = columnOf[c.key] ? cellText(row.getCell(columnOf[c.key]).value) : "";
    }

    if (COLUMNS.some((c) => item[c.key] !== "")) rows.push(item);
  }

  return rows;
}

export const importMaster = async (req, res) => {
  try {
    const { sessionId } = req.query;
    const role = req.user?.role;

    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "A valid sessionId is required" });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ success: false, message: "No file received" });
    }

    let rows;

    try {
      rows = await readRows(req.body);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message });
      }

      return res.status(400).json({
        success: false,
        message: "Could not read the file. Please upload an .xlsx file (Excel 2007 or newer).",
      });
    }

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "The sheet has no data rows" });
    }

    // ---------- look up everything the file mentions, once ----------
    const courseCodes = [...new Set(rows.map((r) => r.course.toUpperCase()).filter(Boolean))];
    const subjectCodes = [...new Set(rows.map((r) => r.code).filter(Boolean))];
    const facultyCodes = [...new Set(rows.map((r) => r.facultyId).filter(Boolean))];

    const [dbCourses, dbSubjects, dbFaculty] = await Promise.all([
      Course.find({ courseId: { $in: courseCodes } }),
      Subject.find({ subjectId: { $in: subjectCodes } }),
      Faculty.find({ facultyId: { $in: facultyCodes } }),
    ]);

    const courseByCode = new Map(dbCourses.map((c) => [c.courseId, c]));
    const subjectByCode = new Map(dbSubjects.map((s) => [s.subjectId, s]));
    const facultyByCode = new Map(dbFaculty.map((f) => [f.facultyId, f]));

    // ---------- validate ----------
    const errors = [];
    const warnings = [];
    const problem = (row, message) => errors.push({ row, message });

    const coursePlans = new Map(); // courseId -> { existing, semester, students, items[] }
    const newSubjects = new Map(); // code -> { data, row }
    const seen = new Map(); // "course|code" -> row

    for (const r of rows) {
      const courseId = r.course.toUpperCase();

      if (!courseId) {
        problem(r.row, "Course is required");
        continue;
      }

      // ----- course -----
      const existing = courseByCode.get(courseId) || null;

      if (existing && String(existing.session) !== String(session._id)) {
        problem(r.row, `Course ${courseId} already exists in another session`);
        continue;
      }

      let plan = coursePlans.get(courseId);

      if (!plan) {
        plan = { courseId, existing, semester: null, students: null, items: [] };
        coursePlans.set(courseId, plan);
      }

      if (!existing) {
        const sem = toNumber(r.semester);
        const students = toNumber(r.students);

        if (r.semester !== "") {
          if (!Number.isInteger(sem) || sem < 1) problem(r.row, `Sem must be a whole number, 1 or more (got "${r.semester}")`);
          else if (plan.semester === null) plan.semester = sem;
          else if (plan.semester !== sem) problem(r.row, `Sem ${sem} differs from the one given for ${courseId} earlier (${plan.semester})`);
        }

        if (r.students !== "") {
          if (!Number.isInteger(students) || students < 1) problem(r.row, `Students must be a whole number, 1 or more (got "${r.students}")`);
          else if (plan.students === null) plan.students = students;
          else if (plan.students !== students) problem(r.row, `Students ${students} differs from the number given for ${courseId} earlier (${plan.students})`);
        }
      }

      // a row with no code and no title only declares the course
      if (!r.code && !r.title) continue;

      if (!r.code) {
        problem(r.row, "Course code is required");
        continue;
      }

      // ----- duplicate row -----
      const dupKey = `${courseId}|${r.code}`;

      if (seen.has(dupKey)) {
        problem(r.row, `${r.code} is repeated for ${courseId} (first seen in row ${seen.get(dupKey)})`);
        continue;
      }

      seen.set(dupKey, r.row);

      // ----- subject -----
      const dbSubject = subjectByCode.get(r.code);

      if (dbSubject) {
        const given = [r.title && r.title !== dbSubject.name, r.type && r.type.toLowerCase() !== dbSubject.type]
          .some(Boolean);

        if (given) {
          warnings.push({ row: r.row, message: `${r.code} already exists, so its details in the sheet were not applied` });
        }
      } else if (!newSubjects.has(r.code)) {
        const type = r.type.toLowerCase();
        const l = toNumber(r.l) ?? 0;
        const t = toNumber(r.t) ?? 0;
        const p = toNumber(r.p) ?? 0;
        const credits = toNumber(r.credits);
        const category = (r.category || "course").toLowerCase();
        let ok = true;

        const bad = (message) => {
          problem(r.row, `${r.code}: ${message}`);
          ok = false;
        };

        if (!can(role, "addSubject")) bad("is a new subject and you cannot create subjects");
        if (!r.title) bad("Course title is required for a new subject");
        if (!["theory", "lab"].includes(type)) bad("Type must be Theory or Lab for a new subject");
        if (![l, t, p].every((n) => Number.isFinite(n) && n >= 0)) bad("L, T and P must be numbers, 0 or more");
        if (!Number.isFinite(credits) || credits < 0) bad("Credits must be a number, 0 or more");
        if (!["course", "elective"].includes(category)) bad("Category must be Course or Elective");

        if (ok) {
          newSubjects.set(r.code, {
            row: r.row,
            data: {
              subjectId: r.code,
              name: r.title,
              noOfClasses: l + t + p,
              type,
              credits,
              ltp: [l, t, p],
              category,
              courses: [],
            },
          });
        } else {
          continue;
        }
      }

      // ----- faculty -----
      let facultyDoc = null;

      if (r.facultyId) {
        facultyDoc = facultyByCode.get(r.facultyId) || null;

        if (!facultyDoc) {
          problem(r.row, `Faculty ID "${r.facultyId}" not found`);
          continue;
        }

        if (!can(role, "assignFaculty")) {
          problem(r.row, "You cannot assign faculty");
          continue;
        }
      }

      plan.items.push({ row: r.row, code: r.code, facultyDoc });
    }

    // a course that will be created needs its Sem and Students
    for (const plan of coursePlans.values()) {
      if (plan.existing) continue;

      const firstRow = rows.find((r) => r.course.toUpperCase() === plan.courseId)?.row;

      if (plan.semester === null) problem(firstRow, `${plan.courseId} is a new course: Sem is required`);
      if (plan.students === null) problem(firstRow, `${plan.courseId} is a new course: Students is required`);
    }

    if (errors.length) {
      errors.sort((a, b) => a.row - b.row);

      return res.status(422).json({
        success: false,
        message: `${errors.length} problem${errors.length === 1 ? "" : "s"} found. Nothing was imported - fix the rows below and upload again.`,
        errors: errors.slice(0, MAX_ERRORS_RETURNED),
        totalErrors: errors.length,
      });
    }

    // ---------- apply ----------
    const stats = {
      rowsRead: rows.length,
      coursesCreated: 0,
      subjectsCreated: 0,
      subjectsAddedToCourses: 0,
      facultyAssigned: 0,
    };

    try {
      const subjectDocs = new Map(subjectByCode); // code -> Subject doc

      for (const [code, { data }] of newSubjects) {
        subjectDocs.set(code, await Subject.create(data));
        stats.subjectsCreated++;
      }

      for (const plan of coursePlans.values()) {
        let course = plan.existing;

        if (!course) {
          course = new Course({
            courseId: plan.courseId,
            session: session._id,
            semester: plan.semester,
            noOfStudents: plan.students,
            subjects: [],
            slug: plan.courseId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          });

          stats.coursesCreated++;
        }

        const facultyOps = []; // { oldId, newId, subjectId }

        for (const item of plan.items) {
          const subject = subjectDocs.get(item.code);

          let entry = course.subjects.find(
            (s) => String(s.subject) === String(subject._id),
          );

          if (!entry) {
            course.subjects.push({ subject: subject._id, faculty: null });
            entry = course.subjects[course.subjects.length - 1];
            stats.subjectsAddedToCourses++;
          }

          if (item.facultyDoc && String(entry.faculty || "") !== String(item.facultyDoc._id)) {
            facultyOps.push({
              oldId: entry.faculty,
              newId: item.facultyDoc._id,
              subjectId: subject._id,
            });

            entry.faculty = item.facultyDoc._id;
            stats.facultyAssigned++;
          }
        }

        await course.save();

        if (plan.existing === null) {
          await Session.findByIdAndUpdate(session._id, { $addToSet: { courses: course._id } });
        }

        // keep Subject.courses and Faculty.subjects in step (same as the manual screens)
        for (const item of plan.items) {
          await Subject.findByIdAndUpdate(subjectDocs.get(item.code)._id, {
            $addToSet: { courses: course._id },
          });
        }

        for (const op of facultyOps) {
          if (op.oldId && String(op.oldId) !== String(op.newId)) {
            await Faculty.findByIdAndUpdate(op.oldId, { $pull: { subjects: op.subjectId } });
          }

          await Faculty.findByIdAndUpdate(op.newId, { $addToSet: { subjects: op.subjectId } });
        }
      }
    } catch (error) {
      console.error("MASTER IMPORT APPLY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: `Import stopped part-way: ${error.message}. Some rows may already be saved - check the master table before uploading again.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Import complete",
      stats,
      warnings: warnings.slice(0, MAX_ERRORS_RETURNED),
    });
  } catch (error) {
    console.error("MASTER IMPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not import the file",
      error: error.message,
    });
  }
};