"use client";

import { useMemo } from "react";
import ClassBlock from "./ClassBlock";
import styles from "./MiniTimetable.module.css";

export default function MiniTimetable({
  title,
  subtitle,
  days = [],
  periods = [],
  entries = [],
  courses = [],
  accent,
  acceptsDrop = false,
  onDropBlock,
  entityId,
  onCellClick,
}) {
  const cells = useMemo(
    () =>
      days.flatMap((day) =>
        periods.map((period, periodIndex) => ({
          day,
          period,
          periodIndex,
          entry: entries.find(
            (item) =>
              item.day === day && String(item.periodId) === String(period.id),
          ),
        })),
      ),
    [days, periods, entries],
  );

  function formatTime(time) {
    const [hour, minute] = time.split(":");
    const h = Number(hour);

    if (minute === "00") {
      return String(h);
    }

    return `${h}:${minute}`;
  }

  function getCourse(entry) {
    if (!entry) return null;

    return (
      courses.find((course) => String(course._id) === String(entry.courseId)) ||
      entry.course
    );
  }

  function isContinuation(day, periodIndex) {
    if (periodIndex === 0) return false;

    for (let i = 0; i < periodIndex; i++) {
      const previousEntry = entries.find(
        (item) =>
          item.day === day && String(item.periodId) === String(periods[i].id),
      );

      if (!previousEntry) continue;

      const duration = Number(previousEntry.duration) || 1;

      if (i + duration > periodIndex) {
        return true;
      }
    }

    return false;
  }

  function handleDrop(event, day, periodId) {
    event.preventDefault();

    if (!acceptsDrop) return;

    try {
      const raw = event.dataTransfer.getData("application/json");

      if (!raw) return;

      const payload = JSON.parse(raw);

      if (payload.kind === "legend") {
        onDropBlock?.(payload, day, periodId, entityId);
        return;
      }

      if (payload.kind === "class-block") {
        onDropBlock?.(payload, day, periodId, entityId);
      }
    } catch (error) {
      console.error("MINI TIMETABLE DROP ERROR:", error);
    }
  }

  return (
    <article
      data-venue-id={accent === "venue" ? entityId : undefined}
      className={`${styles.card} ${styles[`accent-${accent}`]}`}
    >
      <div className={styles.header}>
        <div>
          <h3>{title}</h3>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        {acceptsDrop && <span className={styles.dropHint}>Drop class</span>}
      </div>

      <div className={styles.gridScroll}>
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `34px repeat(${periods.length}, minmax(0, 1fr))`,
          }}
        >
          {/* Empty corner */}
          <div />

          {/* Period headers */}
          {periods.map((period) => {
            const [start, end] = period.label.split(" - ");

            return (
              <div
                key={period.id}
                className={styles.period}
                title={period.label}
              >
                {formatTime(start)}-{formatTime(end)}
              </div>
            );
          })}

          {/* Days */}
          {days.map((day) => (
            <div key={day} className={styles.row}>
              <div className={styles.day}>{day[0]}</div>

              {periods.map((period, periodIndex) => {
                const entry = entries.find(
                  (item) =>
                    item.day === day &&
                    String(item.periodId) === String(period.id),
                );

                /*
                 * Don't render another cell when this period
                 * is already covered by a previous multi-period class.
                 */
                if (isContinuation(day, periodIndex)) {
                  return null;
                }

                const duration = entry
                  ? Math.min(
                      Number(entry.duration) || 1,
                      periods.length - periodIndex,
                    )
                  : 1;

                return (
                  <div
                    key={`${day}-${period.id}`}
                    className={`${styles.cell} ${
                      acceptsDrop ? styles.dropCell : ""
                    }`}
                    style={
                      entry
                        ? {
                            gridColumn: `${periodIndex + 2} / span ${duration}`,
                          }
                        : {
                            gridColumn: periodIndex + 2,
                          }
                    }
                    onClick={() => onCellClick?.(day, period.id)}
                    onDragOver={
                      acceptsDrop
                        ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "copy";
                          }
                        : undefined
                    }
                    onDrop={
                      acceptsDrop
                        ? (event) => handleDrop(event, day, period.id)
                        : undefined
                    }
                  >
                    {entry ? (
                      <ClassBlock
                        block={entry}
                        subject={entry.subject}
                        faculty={entry.faculty}
                        venue={entry.venue}
                        course={getCourse(entry)}
                        variant={accent}
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
      </div>
    </article>
  );
}
