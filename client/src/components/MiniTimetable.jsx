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

  function formatTime(time) {
    const [hour, minute] = time.split(":");
    const h = Number(hour);

    if (minute === "00") {
      return String(h);
    }

    return `${h}:${minute}`;
  }

  function handleDrop(event, day, periodId) {
    event.preventDefault();

    if (!acceptsDrop) return;

    try {
      const raw = event.dataTransfer.getData("application/json");

      if (!raw) return;

      const payload = JSON.parse(raw);

      console.log("MINI TIMETABLE DROP:", payload);

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
          <p className={styles.kicker}>
            {accent === "venue" ? "Venue TT" : "Faculty TT"}
          </p>

          <h3>{title}</h3>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        {acceptsDrop && <span className={styles.dropHint}>Drop class</span>}
      </div>

      <div className={styles.gridScroll}>
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `34px repeat(${periods.length}, 54px)`,
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

          {/* Days and cells */}
          {days.map((day) => (
            <div key={day} className={styles.row}>
              <div className={styles.day}>{day[0]}</div>

              {cells
                .filter((cell) => cell.day === day)
                .map(({ period, entry }) => (
                  <div
                    key={`${day}-${period.id}`}
                    className={`${styles.cell} ${
                      acceptsDrop ? styles.dropCell : ""
                    }`}
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
                      />
                    ) : (
                      acceptsDrop && <span className={styles.plus}>+</span>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
