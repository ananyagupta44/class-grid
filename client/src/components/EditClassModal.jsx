"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import styles from "./EditClassModal.module.css";

// Handles both creating a new class in an empty slot and editing an existing
// one. `initial` carries day/periodId (and the entry id, when editing).
export default function EditClassModal({ open, initial, courses, faculties, venues, days, periods, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || {});
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initial || {});
    setError("");
  }, [initial, open]);

  if (!open) return null;

  const teachingPeriods = periods.filter((p) => !p.isBreak);
  const isEditing = Boolean(initial?.id);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.courseId || !form.facultyId || !form.venueId || !form.day || !form.periodId) {
      setError("Fill in every field before saving.");
      return;
    }
    const result = onSave(form);
    if (result && result.ok === false) {
      setError(result.reason || "That slot conflicts with an existing class.");
    }
  }

  return (
    <Modal
      open={open}
      title={isEditing ? "Edit class" : "Schedule a class"}
      onClose={onClose}
      footer={
        <>
          {isEditing ? (
            <button type="button" className={styles.dangerBtn} onClick={() => onDelete(form.id)}>
              Remove
            </button>
          ) : null}
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={handleSave}>
            Save class
          </button>
        </>
      }
    >
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Day</span>
          <select value={form.day || ""} onChange={(e) => update("day", e.target.value)}>
            <option value="" disabled>Select day</option>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Time slot</span>
          <select value={form.periodId || ""} onChange={(e) => update("periodId", e.target.value)}>
            <option value="" disabled>Select time</option>
            {teachingPeriods.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Course</span>
          <select value={form.courseId || ""} onChange={(e) => update("courseId", e.target.value)}>
            <option value="" disabled>Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code} &middot; {c.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Faculty</span>
          <select value={form.facultyId || ""} onChange={(e) => update("facultyId", e.target.value)}>
            <option value="" disabled>Select faculty</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Venue</span>
          <select value={form.venueId || ""} onChange={(e) => update("venueId", e.target.value)}>
            <option value="" disabled>Select venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </Modal>
  );
}
