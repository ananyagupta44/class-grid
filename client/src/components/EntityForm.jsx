"use client";

import { useState } from "react";
import styles from "./EntityForm.module.css";

const FIELD_CONFIG = {
  course: [
    { name: "code", label: "Course code", placeholder: "CS301" },
    { name: "name", label: "Course name", placeholder: "Data Structures" },
    { name: "semester", label: "Semester", placeholder: "3rd" },
    {
      name: "periodsPerWeek",
      label: "Classes per week",
      placeholder: "3",
      type: "number",
    },
    { name: "facultyId", label: "Primary faculty", type: "facultySelect" },
  ],
  faculty: [
    { name: "name", label: "Full name", placeholder: "Dr. Anil Mehta" },
    { name: "dept", label: "Department", placeholder: "Computer Science" },
    { name: "email", label: "Email", placeholder: "name@college.edu" },
  ],
  venue: [
    { name: "name", label: "Venue name", placeholder: "Room 204" },
    { name: "type", label: "Type", placeholder: "Classroom / Lab" },
    { name: "capacity", label: "Capacity", placeholder: "60" },
  ],
};

// facultyOptions is only needed (and only passed) when type === "course",
// so the "Primary faculty" field can be a dropdown instead of free text.
export default function EntityForm({ type, onSubmit, facultyOptions = [] }) {
  const fields = FIELD_CONFIG[type];
  const [values, setValues] = useState({});

  function update(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const filled = fields.every(
      (f) => (values[f.name] || "").trim().length > 0,
    );
    if (!filled) return;
    const payload = { ...values };
    if ("periodsPerWeek" in payload)
      payload.periodsPerWeek = Number(payload.periodsPerWeek);
    onSubmit(payload);
    setValues({});
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {fields.map((field) => (
        <label key={field.name} className={styles.field}>
          <span>{field.label}</span>
          {field.type === "facultySelect" ? (
            <select
              value={values[field.name] || ""}
              onChange={(e) => update(field.name, e.target.value)}
            >
              <option value="" disabled>
                Select faculty
              </option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              min={field.type === "number" ? 0 : undefined}
              placeholder={field.placeholder}
              value={values[field.name] || ""}
              onChange={(e) => update(field.name, e.target.value)}
            />
          )}
        </label>
      ))}
      <button type="submit" className={styles.submit}>
        Add {type}
      </button>
    </form>
  );
}
