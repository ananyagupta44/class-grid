"use client";

import { useMemo } from "react";
import ClassBlock from "./ClassBlock";
import styles from "./MiniTimetable.module.css";

export default function MiniTimetable({
  title,
  subtitle,
  days,
  periods,
  entries,
  courses,
  faculties,
  venues,
  accent,
  acceptsDrop = false,
  onDropBlock,
  entityId,
}) {
  const cells = useMemo(
    () =>
      days.flatMap((day) =>
        periods.map((period) => ({
          day,
          period,
          entry: entries.find(
            (item) => item.day === day && item.periodId === period.id,
          ),
        })),
      ),
    [days, periods, entries],
  );

  return (
    <article data-venue-id={accent === "venue" ? entityId : undefined} className={`${styles.card} ${styles[`accent-${accent}`]}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{accent === "venue" ? "Venue TT" : "Faculty TT"}</p>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {acceptsDrop ? <span className={styles.dropHint}>Drop class</span> : null}
      </div>

      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `34px repeat(${periods.length}, minmax(46px, 1fr))` }}
      >
        <div />
        {periods.map((period) => (
          <div key={period.id} className={styles.period}>
            {period.label}
          </div>
        ))}

        {days.map((day) => (
          <div key={day} className={styles.row}>
            <div className={styles.day}>{day[0]}</div>

            {cells
              .filter((cell) => cell.day === day)
              .map(({ period, entry }) => {
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
                  <div
                    key={`${day}-${period.id}`}
                    className={`${styles.cell} ${acceptsDrop ? styles.dropCell : ""}`}
                    onDragOver={
                      acceptsDrop
                        ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }
                        : undefined
                    }
                    onDrop={
                      acceptsDrop
                        ? (event) => onDropBlock?.(event, day, period.id)
                        : undefined
                    }
                  >
                    {entry ? (
                      <ClassBlock
                        block={entry}
                        subject={subject}
                        faculty={faculty}
                        venue={venue}
                        compact
                      />
                    ) : (
                      acceptsDrop && <span className={styles.plus}>+</span>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </article>
  );
}
