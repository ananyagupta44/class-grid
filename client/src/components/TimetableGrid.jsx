"use client";

import ClassBlock from "./ClassBlock";
import styles from "./TimetableGrid.module.css";

export default function TimetableGrid({
  days,
  periods,
  entries,
  courses,
  faculties,
  venues,
  onDropEntry,
}) {
  return (
    <div className={styles.table}>
      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: `58px repeat(${periods.length}, minmax(72px, 1fr))`,
        }}
      >
        <div className={styles.corner}>TIME</div>

        {periods.map((period) => (
          <div key={period.id} className={styles.periodHeader}>
            {period.label}
          </div>
        ))}

        {days.map((day) => (
          <div key={day} className={styles.rowGroup}>
            <div className={styles.dayCell}>{day}</div>

            {periods.map((period) => {
              const entry = entries.find(
                (item) => item.day === day && item.periodId === period.id,
              );

              const course = entry
                ? courses.find((item) => item.id === entry.courseId)
                : null;
              const subject = course?.subjects.find(
                (item) => item.id === entry?.subjectId,
              );
              const faculty = entry
                ? faculties.find((item) => item.id === entry.facultyId)
                : null;
              const venue = entry
                ? venues.find((item) => item.id === entry.venueId)
                : null;

              return (
                <div key={`${day}-${period.id}`} className={styles.slotCell}>
                  {entry ? (
                    <ClassBlock
                      block={entry}
                      subject={subject}
                      faculty={faculty}
                      venue={venue}
                      compact
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
