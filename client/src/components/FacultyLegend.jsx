"use client";

import styles from "./FacultyLegend.module.css";

export default function FacultyLegend({
  legend = [],
  faculties = [],
  onAssignFaculty,
  onDrop,
}) {
  if (!legend.length) {
    return (
      <section className={styles.panel}>
        <p className={styles.label}>Faculty Legend</p>

        <p className={styles.done}>No subjects are assigned to this course.</p>
      </section>
    );
  }

  function startDrag(event, item, block) {
    event.dataTransfer.effectAllowed = "copy";

    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        kind: "legend",

        courseId: item.courseId,

        subjectId: item.subject.id,

        facultyId: item.faculty?.id || "",

        blockType: block.type,

        blockNumber: block.number,
      }),
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
      </div>

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

                <select
                  value={assignedFaculty?.id || ""}
                  onChange={(e) => onAssignFaculty(subject.id, e.target.value)}
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
              </div>

              <div className={styles.blockRow}>
                {remaining.length ? (
                  remaining.map((block) => (
                    <button
                      key={`${subject.id}-${block.type}-${block.number}`}
                      type="button"
                      draggable
                      className={styles.chip}
                      onDragStart={(event) => startDrag(event, item, block)}
                      title={`Drag ${block.label} to the timetable`}
                    >
                      {block.label}
                    </button>
                  ))
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
