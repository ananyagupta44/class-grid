"use client";

import { useEffect, useMemo, useState } from "react";

import Modal from "./Modal";

import styles from "./EditClassModal.module.css";

export default function EditClassModal({
  open,
  initial,
  course,
  faculties = [],
  venues = [],
  days = [],
  periods = [],
  courses = [],
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(initial || {});
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(initial?.duration || 1);
  const [classType, setClassType] = useState("regular");
  const [comboCourseId, setComboCourseId] = useState("");
  const [comboSubjectId, setComboSubjectId] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      ...initial,
      courseId: initial?.courseId || course?._id || course?.id,
    });

    setDuration(Number(initial?.duration) || 1);

    setClassType(initial?.comboGroupId ? "combo" : "regular");

    setComboCourseId(initial?.comboCourseId || "");
    setComboSubjectId(initial?.comboSubjectId || "");

    setError("");
  }, [open, initial, course]);

  const subjects = useMemo(() => course?.subjects || [], [course]);

  const comboCourse = useMemo(
    () =>
      courses.find(
        (item) => String(item._id || item.id) === String(comboCourseId),
      ),
    [courses, comboCourseId],
  );

  const comboSubjects = useMemo(
    () => comboCourse?.subjects || [],
    [comboCourse],
  );

  const selectedAssignment = useMemo(() => {
    return subjects.find(
      (item) =>
        String(item.subject?._id || item.subject?.id) ===
        String(form.subjectId),
    );
  }, [subjects, form.subjectId]);

  const selectedSubject = selectedAssignment?.subject || null;

  const isLab = selectedSubject?.type === "lab";

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSubjectChange(subjectId) {
    const assignment = subjects.find(
      (item) =>
        String(item.subject?._id || item.subject?.id) === String(subjectId),
    );

    setForm((prev) => ({
      ...prev,

      subjectId,

      facultyId: assignment?.faculty?._id || assignment?.faculty?.id || "",
    }));

    /*
     * Normal classes are always one period.
     * When switching to a lab, default to 1
     * and let the user choose 1/2/3.
     */
    setDuration(
      assignment?.subject?.type === "lab" ? Number(initial?.duration) || 1 : 1,
    );
  }

  async function handleSave() {
    setError("");

    if (
      !form.subjectId ||
      !form.facultyId ||
      !form.venueId ||
      !form.day ||
      !form.periodId
    ) {
      setError("Please select subject, faculty, venue, day and time.");
      return;
    }

    if (classType === "combo") {
      if (!comboCourseId || !comboSubjectId) {
        setError("Please select the second course and subject.");
        return;
      }

      const classDuration = isLab
        ? Math.min(Math.max(Number(duration) || 1, 1), 3)
        : 1;

      const payload = {
        course1Id: form.courseId || course?._id || course?.id,
        subject1Id: form.subjectId,

        course2Id: comboCourseId,
        subject2Id: comboSubjectId,

        facultyId: form.facultyId,
        venueId: form.venueId,

        day: form.day,
        periodId: form.periodId,
        duration: classDuration,
      };

      const result = await onSave({
        ...payload,
        isCombo: true,
        comboGroupId: form.comboGroupId,
        id: form.id || form._id,
      });

      if (!result?.ok) {
        setError(
          result?.reason ||
            result?.message ||
            "Unable to schedule this combo class.",
        );
      }

      return;
    }

    // EXISTING REGULAR CLASS FLOW
    const classDuration = isLab
      ? Math.min(Math.max(Number(duration) || 1, 1), 3)
      : 1;

    const payload = {
      ...form,
      courseId: form.courseId || course?._id || course?.id,
      duration: classDuration,
    };

    console.log("MODAL SAVE PAYLOAD:", payload);

    const result = await onSave(payload);

    console.log("MODAL SAVE RESULT:", result);

    if (!result?.ok) {
      setError(
        result?.reason || result?.message || "Unable to schedule this class.",
      );
    }
  }

  async function handleDelete() {
    if (!onDelete) return;

    const id = form.id || form._id;

    if (!id) return;

    const result = await onDelete(id);

    if (!result?.ok) {
      setError(
        result?.reason || result?.message || "Unable to delete this class.",
      );
    }
  }

  if (!open) return null;

  const isEditing = Boolean(initial?.id || initial?._id);

  return (
    <Modal
      open={open}
      title={isEditing ? "Edit class" : "Add class"}
      onClose={onClose}
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="classType">Class Type</label>

          <select
            id="classType"
            value={classType}
            onChange={(e) => {
              const value = e.target.value;

              setClassType(value);

              if (value === "regular") {
                setComboCourseId("");
                setComboSubjectId("");
              }
            }}
            disabled={isEditing}
          >
            <option value="regular">Regular Class</option>
            <option value="combo">Combo Class</option>
          </select>
        </div>
        {/* SUBJECT */}

        <div className={styles.field}>
          <label htmlFor="subject">Subject</label>

          <select
            id="subject"
            value={form.subjectId || ""}
            onChange={(e) => handleSubjectChange(e.target.value)}
          >
            <option value="">Select subject</option>

            {subjects.map((item) => {
              const subject = item.subject;

              if (!subject) return null;

              const subjectId = subject._id || subject.id;

              return (
                <option key={subjectId} value={subjectId}>
                  {subject.subjectId} — {subject.name}
                </option>
              );
            })}
          </select>
        </div>

        {classType === "combo" && (
          <>
            <div className={styles.field}>
              <label htmlFor="comboCourse">Second Course</label>

              <select
                id="comboCourse"
                value={comboCourseId}
                onChange={(e) => {
                  setComboCourseId(e.target.value);
                  setComboSubjectId("");
                }}
              >
                <option value="">Select second course</option>

                {courses
                  .filter(
                    (item) =>
                      String(item._id || item.id) !== String(form.courseId),
                  )
                  .map((item) => {
                    const id = item._id || item.id;

                    return (
                      <option key={id} value={id}>
                        {item.courseId} — Semester {item.semester}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="comboSubject">Second Subject</label>

              <select
                id="comboSubject"
                value={comboSubjectId}
                onChange={(e) => {
                  const subjectId = e.target.value;

                  const assignment = comboSubjects.find(
                    (item) =>
                      String(item.subject?._id || item.subject?.id) ===
                      String(subjectId),
                  );

                  const secondFacultyId =
                    assignment?.faculty?._id || assignment?.faculty?.id || "";

                  if (
                    secondFacultyId &&
                    form.facultyId &&
                    String(secondFacultyId) !== String(form.facultyId)
                  ) {
                    setError(
                      "The selected subject is taught by a different faculty member. Both combo subjects must have the same faculty.",
                    );
                    setComboSubjectId("");
                    return;
                  }

                  setError("");
                  setComboSubjectId(subjectId);
                }}
                disabled={!comboCourseId}
              >
                <option value="">Select second subject</option>

                {comboSubjects.map((item) => {
                  const subject = item.subject;

                  if (!subject) return null;

                  const id = subject._id || subject.id;

                  return (
                    <option key={id} value={id}>
                      {subject.subjectId} — {subject.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        )}

        {/* LAB DURATION */}

        {isLab && (
          <div className={styles.field}>
            <label htmlFor="duration">Lab Duration</label>

            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={1}>1 period</option>

              <option value={2}>2 periods</option>

              <option value={3}>3 periods</option>
            </select>

            <small>
              This practical will occupy {duration} consecutive{" "}
              {duration === 1 ? "period" : "periods"}.
            </small>
          </div>
        )}

        {/* FACULTY */}

        <div className={styles.field}>
          <label htmlFor="faculty">Faculty</label>

          <select
            id="faculty"
            value={form.facultyId || ""}
            onChange={(e) => update("facultyId", e.target.value)}
          >
            <option value="">Select faculty</option>

            {faculties.map((faculty) => {
              const facultyId = faculty._id || faculty.id;

              return (
                <option key={facultyId} value={facultyId}>
                  {faculty.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* VENUE */}

        <div className={styles.field}>
          <label htmlFor="venue">Venue</label>

          <select
            id="venue"
            value={form.venueId || ""}
            onChange={(e) => update("venueId", e.target.value)}
          >
            <option value="">Select venue</option>

            {venues.map((venue) => {
              const venueId = venue._id || venue.id;

              return (
                <option key={venueId} value={venueId}>
                  {venue.roomNo || venue.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* DAY */}

        <div className={styles.field}>
          <label htmlFor="day">Day</label>

          <select
            id="day"
            value={form.day || ""}
            onChange={(e) => update("day", e.target.value)}
          >
            <option value="">Select day</option>

            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>

        {/* STARTING PERIOD */}

        <div className={styles.field}>
          <label htmlFor="period">Start Time</label>

          <select
            id="period"
            value={form.periodId || ""}
            onChange={(e) => update("periodId", e.target.value)}
          >
            <option value="">Select starting time</option>

            {periods
              .filter((period) => !period.isBreak)
              .map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
          </select>

          {isLab && (
            <small>
              This is the starting period. The class will continue for{" "}
              {duration} {duration === 1 ? "period" : "periods"}.
            </small>
          )}
        </div>

        {/* ERROR */}

        {error && <div className={styles.error}>{error}</div>}

        {/* ACTIONS */}

        <div className={styles.actions}>
          {isEditing && onDelete && (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={handleDelete}
            >
              Delete
            </button>
          )}

          <div className={styles.actionRight}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleSave}
            >
              {isEditing ? "Save Changes" : "Add Class"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
