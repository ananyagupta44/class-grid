"use client";

import { useMemo, useState } from "react";

import { buildMasterModel, filterMasterModel } from "./masterTableModel";
import styles from "./page.module.css";

/*
 * MASTER TABLE — the faculty-allocation sheet for the selected session.
 *
 * One block per course, one row per subject. The + buttons work in place:
 *   + Course / + Faculty / + Subject   (toolbar)
 *   + Add subject                      (under every course)
 *   Faculty cell → + Assign / change   (every row)
 * Each button only appears for roles that are allowed to use it.
 */
export default function MasterTable({
  session,
  courses,
  subjects,
  faculty,
  entries,

  // what the logged-in role may do
  canAddCourse,
  canAddFaculty,
  canAddSubject, // create a brand-new subject (super admin)
  canAddSubjectToCourse,
  canAssignFaculty,

  // actions (the page does the API call, then refreshes its data)
  onAddCourse,
  onAddFaculty,
  onAddSubject,
  onAddSubjectToCourse, // (course, subjectDbId)
  onAssignFaculty, // (course, subjectDbId, facultyDbId)
  onOpenCourse,
}) {
  const [query, setQuery] = useState("");
  const [editingCell, setEditingCell] = useState(""); // row.key being assigned
  const [addingTo, setAddingTo] = useState(""); // course id with the add-subject row open
  const [pickedSubject, setPickedSubject] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  const groups = useMemo(
    () => buildMasterModel({ courses, subjects, faculty, entries }),
    [courses, subjects, faculty, entries],
  );

  const visible = useMemo(
    () => filterMasterModel(groups, query),
    [groups, query],
  );

  const totalSubjects = groups.reduce((sum, group) => sum + group.rows.length, 0);

  async function run(key, task, okText) {
    setBusy(key);
    setMessage(null);

    try {
      await task();
      setMessage({ type: "ok", text: okText });
      return true;
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Something went wrong" });
      return false;
    } finally {
      setBusy("");
    }
  }

  async function assign(group, row, facultyDbId) {
    if (!facultyDbId) return;

    const done = await run(
      row.key,
      () => onAssignFaculty(group.course, row.subjectDbId, facultyDbId),
      `Faculty assigned to ${row.code || "subject"} in ${group.courseId}.`,
    );

    if (done) setEditingCell("");
  }

  async function addSubject(group) {
    if (!pickedSubject) return;

    const done = await run(
      `add-${group.id}`,
      () => onAddSubjectToCourse(group.course, pickedSubject),
      `Subject added to ${group.courseId}.`,
    );

    if (done) {
      setAddingTo("");
      setPickedSubject("");
    }
  }

  function openAddSubject(group) {
    setAddingTo(group.id);
    setPickedSubject("");
    setMessage(null);
  }

  return (
    <section className={styles.masterSection} aria-label="Master table">
      {/* ---------- header + toolbar ---------- */}
      <div className={styles.masterHeader}>
        <div>
          <span className={styles.columnEyebrow}>05</span>

          <div className={styles.columnTitleRow}>
            <h2>Master table</h2>
            <span className={styles.count}>{totalSubjects}</span>
          </div>

          <p className={styles.masterIntro}>
            Faculty allocation for {session?.sessionId || "the selected session"}
            : every course with its subjects, faculty and venues.
          </p>
        </div>

        <div className={styles.masterTools}>
          <input
            type="search"
            className={styles.masterSearch}
            placeholder="Search course, subject, faculty, venue..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search the master table"
          />

          {canAddCourse && (
            <button type="button" className={styles.masterAdd} onClick={onAddCourse}>
              + Course
            </button>
          )}

          {canAddSubject && (
            <button type="button" className={styles.masterAdd} onClick={onAddSubject}>
              + Subject
            </button>
          )}

          {canAddFaculty && (
            <button type="button" className={styles.masterAdd} onClick={onAddFaculty}>
              + Faculty
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={message.type === "error" ? styles.masterError : styles.masterOk}
          role={message.type === "error" ? "alert" : "status"}
        >
          <span>{message.text}</span>

          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* ---------- table ---------- */}
      {groups.length === 0 ? (
        <div className={styles.masterEmpty}>
          No courses in this session yet.
          {canAddCourse && (
            <button type="button" className={styles.masterAdd} onClick={onAddCourse}>
              + Add the first course
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.masterEmpty}>Nothing matches “{query}”.</div>
      ) : (
        <div className={styles.masterScroll}>
          <table className={styles.masterTable}>
            <thead>
              <tr>
                <th scope="col">S.No.</th>
                <th scope="col">Course</th>
                <th scope="col">Sem</th>
                <th scope="col">Type</th>
                <th scope="col">Course code</th>
                <th scope="col">Course title</th>
                <th scope="col">L</th>
                <th scope="col">T</th>
                <th scope="col">P</th>
                <th scope="col">Total credits</th>
                <th scope="col">Faculty</th>
                <th scope="col">Students</th>
                <th scope="col">Lab venue</th>
                <th scope="col">Combined class</th>
              </tr>
            </thead>

            {visible.map((group) => (
              <tbody key={group.id}>
                {/* course header row */}
                <tr className={styles.groupRow}>
                  <td colSpan={14}>
                    <div className={styles.groupLine}>
                      <span className={styles.groupName}>{group.courseId}</span>

                      <span className={styles.groupMeta}>
                        Semester {group.semester} · {group.students} students ·{" "}
                        {group.rows.length} subject
                        {group.rows.length !== 1 ? "s" : ""}
                      </span>

                      <button
                        type="button"
                        className={styles.groupOpen}
                        onClick={() => onOpenCourse(group.course)}
                      >
                        Open timetable →
                      </button>
                    </div>
                  </td>
                </tr>

                {/* subject rows */}
                {group.visibleRows.map((row) => {
                  const editing = editingCell === row.key;

                  return (
                    <tr key={row.key}>
                      <td className={styles.cellCenter}>{row.sNo}</td>
                      <td>{group.courseId}</td>
                      <td className={styles.cellCenter}>{group.semester}</td>

                      <td>
                        {row.type}
                        {row.elective && (
                          <span className={styles.tagElective}>Elective</span>
                        )}
                      </td>

                      <td className={styles.cellMono}>{row.code}</td>
                      <td className={styles.cellTitle}>{row.title}</td>

                      <td className={styles.cellCenter}>{row.l}</td>
                      <td className={styles.cellCenter}>{row.t}</td>
                      <td className={styles.cellCenter}>{row.p}</td>

                      <td className={styles.cellCenter}>
                        {row.credits ?? "—"}
                      </td>

                      {/* FACULTY — assign / change in place */}
                      <td className={styles.cellFaculty}>
                        {editing ? (
                          <select
                            autoFocus
                            defaultValue={row.facultyDbId}
                            disabled={busy === row.key}
                            onChange={(event) =>
                              assign(group, row, event.target.value)
                            }
                            onBlur={() => !busy && setEditingCell("")}
                            onKeyDown={(event) =>
                              event.key === "Escape" && setEditingCell("")
                            }
                            aria-label={`Faculty for ${row.code}`}
                          >
                            <option value="">Select faculty</option>

                            {faculty.map((teacher) => (
                              <option key={teacher._id} value={teacher._id}>
                                {teacher.name} ({teacher.facultyId})
                              </option>
                            ))}
                          </select>
                        ) : row.facultyDbId ? (
                          <span className={styles.facultyLine}>
                            <span>
                              {row.facultyName || "—"}
                              {row.facultyCode && (
                                <small> {row.facultyCode}</small>
                              )}
                            </span>

                            {canAssignFaculty && (
                              <button
                                type="button"
                                className={styles.cellLink}
                                onClick={() => setEditingCell(row.key)}
                                title="Change faculty"
                              >
                                change
                              </button>
                            )}
                          </span>
                        ) : canAssignFaculty ? (
                          <button
                            type="button"
                            className={styles.cellPlus}
                            onClick={() => setEditingCell(row.key)}
                          >
                            + Assign
                          </button>
                        ) : (
                          <span className={styles.cellMuted}>Not assigned</span>
                        )}
                      </td>

                      <td className={styles.cellCenter}>{group.students}</td>

                      <td>
                        {row.labVenues.length ? (
                          row.labVenues.join(" / ")
                        ) : (
                          <span className={styles.cellMuted}>—</span>
                        )}
                      </td>

                      <td>
                        {row.combinedWith.length ? (
                          `with ${row.combinedWith.join(", ")}`
                        ) : (
                          <span className={styles.cellMuted}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* total credits (only meaningful when nothing is filtered out) */}
                <tr className={styles.totalRow}>
                  <td colSpan={5} />
                  <td className={styles.cellTitle}>Total credits</td>
                  <td colSpan={3} />
                  <td className={styles.cellCenter}>{group.totalCredits}</td>
                  <td colSpan={4} />
                </tr>

                {/* + add a subject to this course */}
                {canAddSubjectToCourse && (
                  <tr className={styles.addRow}>
                    <td colSpan={14}>
                      {addingTo === group.id ? (
                        <AddSubjectRow
                          group={group}
                          subjects={subjects}
                          picked={pickedSubject}
                          onPick={setPickedSubject}
                          busy={busy === `add-${group.id}`}
                          canCreate={canAddSubject}
                          onCreate={onAddSubject}
                          onAdd={() => addSubject(group)}
                          onCancel={() => setAddingTo("")}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.cellPlus}
                          onClick={() => openAddSubject(group)}
                        >
                          + Add subject to {group.courseId}
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

// the inline "pick a subject" row under a course
function AddSubjectRow({
  group,
  subjects,
  picked,
  onPick,
  busy,
  canCreate,
  onCreate,
  onAdd,
  onCancel,
}) {
  const inCourse = new Set(group.rows.map((row) => row.subjectDbId));

  const available = subjects.filter((subject) => !inCourse.has(String(subject._id)));

  return (
    <div className={styles.addSubjectRow}>
      {available.length > 0 ? (
        <>
          <select
            autoFocus
            value={picked}
            onChange={(event) => onPick(event.target.value)}
            aria-label={`Subject to add to ${group.courseId}`}
          >
            <option value="">Select a subject</option>

            {available.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.subjectId} — {subject.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.masterAdd}
            onClick={onAdd}
            disabled={!picked || busy}
          >
            {busy ? "Adding..." : "Add"}
          </button>
        </>
      ) : (
        <span className={styles.cellMuted}>
          Every existing subject is already in this course.
        </span>
      )}

      {canCreate && (
        <button type="button" className={styles.cellLink} onClick={onCreate}>
          Create a new subject
        </button>
      )}

      <button type="button" className={styles.cellLink} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
