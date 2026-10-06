"use client";

import styles from "./FacultyLegend.module.css";
import { useState } from "react";

export default function FacultyLegend({
  legend = [],
  faculties = [],
  courseId,
  onAssignFaculty,
  onDrop,
  availableSubjects = [],
  onAddSubject,
  onAddClass,
  selectedBlock = null,
  onSelectBlock,
  canManage = true, // false → no "+ Add Subject" and faculty can't be reassigned
}) {
  const [showSubjects, setShowSubjects] = useState(false);

  function buildPayload(item, block) {
    return {
      kind: "legend",
      courseId,
      subjectId: item.subject?._id || item.subject?.id,
      facultyId: item.faculty?._id || item.faculty?.id || "",
      blockType: block.type,
      blockNumber: block.number,
      duration: block.duration || 1, // a 3-hour lab is ONE block of 3 periods
    };
  }

  function isSelected(payload) {
    return (
      !!selectedBlock &&
      selectedBlock.subjectId === payload.subjectId &&
      selectedBlock.blockType === payload.blockType &&
      selectedBlock.blockNumber === payload.blockNumber
    );
  }

  function startDrag(event, item, block) {
    event.dataTransfer.effectAllowed = "copy";

    event.dataTransfer.setData(
      "application/json",
      JSON.stringify(buildPayload(item, block)),
    );
  }

  function handleDrop(event) {
    event.preventDefault();

    try {
      const raw = event.dataTransfer.getData("application/json");

      if (!raw) return;

      const payload = JSON.parse(raw);

      const target = event.currentTarget;

      const day = target.dataset.day;

      const periodId = target.dataset.period;

      onDrop?.(payload, day, periodId);
    } catch (err) {
      console.error("LEGEND DROP:", err);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>Faculty Legend</p>

          <h2>Classes to schedule</h2>
        </div>

        <div className={styles.headerActions}>
          {legend.length > 0 && (
            <button
              type="button"
              className={styles.addClass}
              onClick={() => onAddClass?.()}
            >
              + Add Class
            </button>
          )}

          {canManage && (
            <button
              type="button"
              className={styles.addSubject}
              onClick={() => setShowSubjects((prev) => !prev)}
            >
              + Add Subject
            </button>
          )}
        </div>
      </div>
      {canManage && showSubjects && (
        <div className={styles.subjectPicker}>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;

              onAddSubject?.(event.target.value);

              event.target.value = "";
              setShowSubjects(false);
            }}
          >
            <option value="">Select subject to add</option>

            {availableSubjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.subjectId} — {subject.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.subjectList}>
        {legend.map((item) => {
          const subject = item.subject;

          const assignedFaculty = item.faculty;

          const remaining = item.remainingBlocks || [];

          return (
            <div key={subject.id} className={styles.subject}>
              <div className={styles.subjectInfo}>
                <strong>{subject.subjectId}</strong>

                <span>{subject.name}</span>

                <small>LTP: {(subject.ltp || []).join(" - ")}</small>
              </div>

              <div className={styles.facultyRow}>
                <span>
                  {assignedFaculty
                    ? assignedFaculty.name
                    : "No faculty assigned"}
                </span>

                {canManage && (
                  <select
                    value={assignedFaculty?.id || ""}
                    onChange={(e) =>
                      onAssignFaculty(subject.id, e.target.value)
                    }
                  >
                    <option value="">Select faculty</option>

                    {faculties.map((faculty) => (
                      <option
                        key={faculty._id || faculty.id}
                        value={faculty._id || faculty.id}
                      >
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={styles.blockRow}>
                {remaining.length ? (
                  remaining.map((block) => {
                    const payload = buildPayload(item, block);
                    const selected = isSelected(payload);

                    return (
                      <button
                        key={`${subject.id}-${block.type}-${block.number}`}
                        type="button"
                        draggable
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ""
                        }`}
                        aria-pressed={selected}
                        onDragStart={(event) => startDrag(event, item, block)}
                        onClick={() =>
                          onSelectBlock?.(
                            selected
                              ? null
                              : { ...payload, label: block.label },
                          )
                        }
                        title={`Drag ${block.label} to the timetable, or click it and then click a slot${
                          block.duration > 1
                            ? ` (takes ${block.duration} periods in a row)`
                            : ""
                        }`}
                      >
                        {block.label}
                      </button>
                    );
                  })
                ) : (
                  <span className={styles.done}>All classes scheduled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
