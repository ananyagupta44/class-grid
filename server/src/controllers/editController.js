import mongoose from "mongoose";

import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Faculty from "../models/Faculty.js";
import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";
import Combo from "../models/Combo.js";

/*
 * UPDATE (EDIT) ENDPOINTS
 *
 *   PUT /api/courses/:id
 *   PUT /api/subjects/:id
 *   PUT /api/faculty/:id
 *   PUT /api/rooms/:id
 *
 * Every field is optional: only what is sent is changed.
 * Documents are changed with doc.save() (not findByIdAndUpdate) so that
 * validation runs and the audit log records the change like the other writes.
 *
 * Changes that would break the timetable that already exists (e.g. turning
 * a scheduled lab subject into theory) are refused with a clear message.
 */

/* ---------- helpers ---------- */

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

// works for ObjectIds, strings and populated documents
const idOf = (value) => String(value?._id ?? value ?? "");

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function handleError(res, label, error) {
  console.error(`${label}:`, error);

  if (error.code === 11000) {
    return fail(res, 409, "Another record already uses that ID / number");
  }

  if (error.name === "ValidationError") {
    return fail(res, 400, error.message);
  }

  return res.status(500).json({
    success: false,
    message: "Update failed",
    error: error.message,
  });
}

const isNumber = (value) =>
  value !== "" && value !== null && Number.isFinite(Number(value));

/* ==================================================
   PUT /api/courses/:id
   body (all optional):
   {
     courseId, semester, noOfStudents,
     subjects: [{ subject: <subject _id>, faculty: <faculty _id> | null }]
   }
   Sending `subjects` REPLACES the course's subject list.
   ================================================== */

const POPULATE_COURSE = [
  { path: "session", select: "sessionId" },
  {
    path: "subjects.subject",
    select: "subjectId name noOfClasses type credits ltp category",
  },
  { path: "subjects.faculty", select: "facultyId name designation" },
];

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid course id");
    }

    const course = await Course.findById(id);

    if (!course) return fail(res, 404, "Course not found");

    const body = req.body || {};

    // ---------- plain fields ----------

    if (body.courseId !== undefined) {
      const next = String(body.courseId).trim().toUpperCase();

      if (!next) return fail(res, 400, "Course ID cannot be empty");

      if (next !== course.courseId) {
        const slug = slugify(next);

        const clash = await Course.findOne({
          _id: { $ne: course._id },
          $or: [{ courseId: next }, { slug }],
        }).lean();

        if (clash) {
          return fail(res, 409, `Course ${next} already exists`);
        }

        course.courseId = next;
        course.slug = slug;
      }
    }

    if (body.semester !== undefined) {
      const semester = Number(body.semester);

      if (!Number.isInteger(semester) || semester < 1) {
        return fail(res, 400, "Semester must be a whole number, 1 or more");
      }

      course.semester = semester;
    }

    if (body.noOfStudents !== undefined) {
      if (!isNumber(body.noOfStudents) || Number(body.noOfStudents) < 1) {
        return fail(res, 400, "Number of students must be 1 or more");
      }

      course.noOfStudents = Number(body.noOfStudents);
    }

    // ---------- subjects (+ faculty per subject) ----------

    const removed = []; // subject ids taken out of the course
    const added = []; // subject ids newly put into the course
    const facultyWas = []; // [subjectId, oldFacultyId] pairs to tidy up afterwards
    const facultyNow = []; // [subjectId, newFacultyId] pairs to record

    if (Array.isArray(body.subjects)) {
      const wanted = [];
      const seen = new Set();

      for (const item of body.subjects) {
        const subjectId = typeof item === "string" ? item : item?.subject;
        const facultyId =
          item && typeof item === "object" && item.faculty ? item.faculty : null;

        if (!mongoose.isValidObjectId(subjectId)) {
          return fail(res, 400, "Every subject must be a valid id");
        }

        if (facultyId && !mongoose.isValidObjectId(facultyId)) {
          return fail(res, 400, "Every faculty must be a valid id");
        }

        if (seen.has(String(subjectId))) continue;

        seen.add(String(subjectId));

        wanted.push({
          subject: String(subjectId),
          faculty: facultyId ? String(facultyId) : "",
        });
      }

      // do they all exist?
      const facultyIds = [...new Set(wanted.map((w) => w.faculty).filter(Boolean))];

      const [subjectCount, facultyCount] = await Promise.all([
        Subject.countDocuments({ _id: { $in: wanted.map((w) => w.subject) } }),
        Faculty.countDocuments({ _id: { $in: facultyIds } }),
      ]);

      if (subjectCount !== wanted.length) {
        return fail(res, 404, "One or more subjects were not found");
      }

      if (facultyCount !== facultyIds.length) {
        return fail(res, 404, "One or more faculty were not found");
      }

      const current = new Map(
        course.subjects.map((item) => [idOf(item.subject), item]),
      );

      // subjects being taken out
      for (const key of current.keys()) {
        if (!seen.has(key)) removed.push(key);
      }

      if (removed.length) {
        const [scheduled, inCombo] = await Promise.all([
          TimetableEntry.countDocuments({
            course: course._id,
            subject: { $in: removed },
          }),
          Combo.exists({
            members: {
              $elemMatch: { course: course._id, subject: { $in: removed } },
            },
          }),
        ]);

        if (scheduled) {
          return fail(
            res,
            409,
            "A subject you removed still has classes on this course's timetable. Remove those classes first.",
          );
        }

        if (inCombo) {
          return fail(
            res,
            409,
            "A subject you removed is part of a combined class. Delete that combo first.",
          );
        }
      }

      // faculty changes on subjects that stay
      for (const w of wanted) {
        const existing = current.get(w.subject);

        if (!existing) {
          added.push(w.subject);

          if (w.faculty) facultyNow.push([w.subject, w.faculty]);

          continue;
        }

        const oldFaculty = existing.faculty ? idOf(existing.faculty) : "";

        if (oldFaculty === w.faculty) continue;

        if (oldFaculty) {
          const [scheduled, inCombo] = await Promise.all([
            TimetableEntry.countDocuments({
              course: course._id,
              subject: w.subject,
            }),
            Combo.exists({
              members: {
                $elemMatch: { course: course._id, subject: w.subject },
              },
            }),
          ]);

          if (scheduled || inCombo) {
            return fail(
              res,
              409,
              "You changed the faculty of a subject that already has classes scheduled (or is in a combo). Remove those classes first.",
            );
          }

          facultyWas.push([w.subject, oldFaculty]);
        }

        if (w.faculty) facultyNow.push([w.subject, w.faculty]);
      }

      // faculty of removed subjects need their link tidied up too
      for (const key of removed) {
        const oldFaculty = current.get(key)?.faculty;

        if (oldFaculty) facultyWas.push([key, idOf(oldFaculty)]);
      }

      course.subjects = wanted.map((w) => ({
        subject: w.subject,
        faculty: w.faculty || null,
      }));
    }

    await course.save();

    // ---------- keep the other side of each link in step ----------

    if (added.length) {
      await Subject.updateMany(
        { _id: { $in: added } },
        { $addToSet: { courses: course._id } },
      );
    }

    if (removed.length) {
      await Subject.updateMany(
        { _id: { $in: removed } },
        { $pull: { courses: course._id } },
      );
    }

    for (const [subjectId, facultyId] of facultyNow) {
      await Faculty.findByIdAndUpdate(facultyId, {
        $addToSet: { subjects: subjectId },
      });
    }

    for (const [subjectId, facultyId] of facultyWas) {
      // only unlink when no course still uses this faculty for this subject
      const stillUsed = await Course.exists({
        subjects: { $elemMatch: { subject: subjectId, faculty: facultyId } },
      });

      if (!stillUsed) {
        await Faculty.findByIdAndUpdate(facultyId, {
          $pull: { subjects: subjectId },
        });
      }
    }

    const updated = await Course.findById(course._id).populate(POPULATE_COURSE);

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      course: updated,
    });
  } catch (error) {
    return handleError(res, "UPDATE COURSE ERROR", error);
  }
};

/* ==================================================
   PUT /api/subjects/:id
   body (all optional): subjectId, name, noOfClasses, type, credits,
   ltp [L,T,P], category, requiredRoomCategory, labDuration
   ================================================== */

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid subject id");
    }

    const subject = await Subject.findById(id);

    if (!subject) return fail(res, 404, "Subject not found");

    const body = req.body || {};

    // what the timetable depends on; guarded below
    const before = JSON.stringify({
      type: subject.type,
      ltp: subject.ltp,
      labDuration: subject.labDuration,
      room: subject.requiredRoomCategory || "",
    });

    if (body.subjectId !== undefined) {
      const next = String(body.subjectId).trim();

      if (!next) return fail(res, 400, "Subject ID cannot be empty");

      if (next !== subject.subjectId) {
        const clash = await Subject.findOne({
          _id: { $ne: subject._id },
          subjectId: next,
        }).lean();

        if (clash) return fail(res, 409, "Subject ID already exists");

        subject.subjectId = next;
      }
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) return fail(res, 400, "Subject name cannot be empty");

      subject.name = name;
    }

    if (body.noOfClasses !== undefined) {
      if (!isNumber(body.noOfClasses) || Number(body.noOfClasses) < 0) {
        return fail(res, 400, "Number of classes must be 0 or more");
      }

      subject.noOfClasses = Number(body.noOfClasses);
    }

    if (body.credits !== undefined) {
      if (!isNumber(body.credits) || Number(body.credits) < 0) {
        return fail(res, 400, "Credits must be 0 or more");
      }

      subject.credits = Number(body.credits);
    }

    if (body.type !== undefined) {
      if (!["theory", "lab"].includes(body.type)) {
        return fail(res, 400, "Subject type must be theory or lab");
      }

      subject.type = body.type;
    }

    if (body.ltp !== undefined) {
      if (
        !Array.isArray(body.ltp) ||
        body.ltp.length !== 3 ||
        !body.ltp.every((n) => isNumber(n) && Number(n) >= 0)
      ) {
        return fail(res, 400, "LTP must be three numbers [L, T, P]");
      }

      subject.ltp = body.ltp.map(Number);
    }

    if (body.category !== undefined) {
      if (!["elective", "course"].includes(body.category)) {
        return fail(res, 400, "Category must be elective or course");
      }

      subject.category = body.category;
    }

    if (body.requiredRoomCategory !== undefined) {
      // an empty string clears it
      subject.requiredRoomCategory =
        String(body.requiredRoomCategory).trim() || undefined;
    }

    if (body.labDuration !== undefined) {
      const hours = Number(body.labDuration);

      if (!Number.isInteger(hours) || hours < 1 || hours > 3) {
        return fail(res, 400, "Lab duration must be 1, 2 or 3 periods");
      }

      subject.labDuration = hours;
    }

    const after = JSON.stringify({
      type: subject.type,
      ltp: subject.ltp,
      labDuration: subject.labDuration,
      room: subject.requiredRoomCategory || "",
    });

    if (before !== after) {
      const [scheduled, inCombo] = await Promise.all([
        TimetableEntry.countDocuments({ subject: subject._id }),
        Combo.countDocuments({ "members.subject": subject._id }),
      ]);

      if (scheduled || inCombo) {
        return fail(
          res,
          409,
          "This subject is already scheduled (or in a combo), so its type, L-T-P, lab duration and special-lab requirement can't be changed. Remove its classes / combos first. Name, credits and category can still be edited.",
        );
      }
    }

    await subject.save();

    return res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      subject,
    });
  } catch (error) {
    return handleError(res, "UPDATE SUBJECT ERROR", error);
  }
};

/* ==================================================
   PUT /api/faculty/:id
   body (all optional): facultyId, name, noOfClassesPerWeek, designation
   ================================================== */

export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid faculty id");
    }

    const faculty = await Faculty.findById(id);

    if (!faculty) return fail(res, 404, "Faculty not found");

    const body = req.body || {};

    if (body.facultyId !== undefined) {
      const next = String(body.facultyId).trim();

      if (!next) return fail(res, 400, "Faculty ID cannot be empty");

      if (next !== faculty.facultyId) {
        const clash = await Faculty.findOne({
          _id: { $ne: faculty._id },
          facultyId: next,
        }).lean();

        if (clash) return fail(res, 409, "Faculty ID already exists");

        faculty.facultyId = next;
      }
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) return fail(res, 400, "Faculty name cannot be empty");

      faculty.name = name;
    }

    if (body.noOfClassesPerWeek !== undefined) {
      if (
        !isNumber(body.noOfClassesPerWeek) ||
        Number(body.noOfClassesPerWeek) < 0
      ) {
        return fail(res, 400, "Classes per week must be 0 or more");
      }

      faculty.noOfClassesPerWeek = Number(body.noOfClassesPerWeek);
    }

    if (body.designation !== undefined) {
      if (!["Assistant Professor", "HOD", "Professor"].includes(body.designation)) {
        return fail(
          res,
          400,
          "Designation must be Assistant Professor, HOD or Professor",
        );
      }

      faculty.designation = body.designation;
    }

    await faculty.save();

    return res.status(200).json({
      success: true,
      message: "Faculty updated successfully",
      faculty,
    });
  } catch (error) {
    return handleError(res, "UPDATE FACULTY ERROR", error);
  }
};

/* ==================================================
   PUT /api/rooms/:id
   body (all optional): roomNo, capacity, type, category, requiredRoomCategory
   ================================================== */

export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return fail(res, 400, "Invalid venue id");
    }

    const room = await Room.findById(id);

    if (!room) return fail(res, 404, "Venue not found");

    const body = req.body || {};

    if (body.roomNo !== undefined) {
      const next = String(body.roomNo).trim();

      if (!next) return fail(res, 400, "Room number cannot be empty");

      if (next !== room.roomNo) {
        const clash = await Room.findOne({
          _id: { $ne: room._id },
          roomNo: next,
        }).lean();

        if (clash) return fail(res, 409, "Room already exists");

        room.roomNo = next;
      }
    }

    if (body.capacity !== undefined) {
      if (!isNumber(body.capacity) || Number(body.capacity) < 1) {
        return fail(res, 400, "Capacity must be 1 or more");
      }

      room.capacity = Number(body.capacity);
    }

    if (body.type !== undefined) {
      if (!["lab", "class"].includes(body.type)) {
        return fail(res, 400, "Room type must be either lab or class");
      }

      if (body.type !== room.type) {
        const used = await TimetableEntry.exists({ venue: room._id });

        if (used) {
          return fail(
            res,
            409,
            "Classes are scheduled in this venue, so it can't change between lab and classroom. Remove those classes first.",
          );
        }
      }

      room.type = body.type;
    }

    if (body.category !== undefined) {
      room.category = String(body.category).trim() || undefined;
    }

    if (body.requiredRoomCategory !== undefined) {
      room.requiredRoomCategory =
        String(body.requiredRoomCategory).trim() || undefined;
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      room,
    });
  } catch (error) {
    return handleError(res, "UPDATE ROOM ERROR", error);
  }
};
