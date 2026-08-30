"use client";

import ClassBlock from "./ClassBlock";
import styles from "./TimetableGrid.module.css";

export default function TimetableGrid({
  days = [],
  periods = [],
  entries = [],
  onDropEntry,
  onLegendDrop,
  onCellClick,
  onEditEntry,
}) {
  function getPeriodIndex(periodId) {
    return periods.findIndex((period) => period.id === periodId);
  }

  function getEntry(day, periodId) {
    return entries.find(
      (entry) => entry.day === day && entry.periodId === periodId,
    );
  }

  function handleDrop(event, day, periodId) {
    event.preventDefault();

    try {
      const raw = event.dataTransfer.getData("application/json");

      if (!raw) return;

      const payload = JSON.parse(raw);

      if (payload.kind === "legend") {
        onLegendDrop?.(payload, day, periodId);

        return;
      }

      if (payload.kind === "class-block") {
        onDropEntry?.(payload.id, day, periodId);
      }
    } catch (error) {
      console.error("TIMETABLE DROP:", error);
    }
  }

  return (
    <div className={styles.table}>
      {/* HEADER */}

      <div
        className={styles.headerRow}
        style={{
          gridTemplateColumns: `58px repeat(${periods.length}, minmax(82px, 1fr))`,
        }}
      >
        <div className={styles.corner}>TIME</div>

        {periods.map((period) => (
          <div key={period.id} className={styles.periodHeader}>
            {period.label}
          </div>
        ))}
      </div>

      {/* DAYS */}

      {days.map((day) => {
        const dayEntries = entries.filter((entry) => entry.day === day);

        return (
          <div key={day} className={styles.dayRow}>
            <div className={styles.dayCell}>{day}</div>

            <div
              className={styles.slots}
              style={{
                gridTemplateColumns: `repeat(${periods.length}, minmax(82px, 1fr))`,
              }}
            >
              {/* EMPTY CELLS */}

              {periods.map((period) => {
                const entry = getEntry(day, period.id);

                return (
                  <div
                    key={period.id}
                    className={styles.slotCell}
                    onDragOver={(event) => {
                      event.preventDefault();

                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(event) => handleDrop(event, day, period.id)}
                    onClick={() => onCellClick?.(day, period.id)}
                  >
                    {!entry && <span className={styles.addHint}>+</span>}
                  </div>
                );
              })}

              {/* CLASS BLOCKS */}

              {dayEntries.map((entry) => {
                const startIndex = getPeriodIndex(entry.periodId);

                if (startIndex < 0) {
                  return null;
                }

                const duration = Math.max(1, Number(entry.duration) || 1);

                return (
                  <div
                    key={entry._id || entry.id}
                    className={styles.entryPosition}
                    style={{
                      gridColumnStart: startIndex + 1,

                      gridColumnEnd: `span ${duration}`,

                      gridRow: 1,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();

                      onEditEntry?.(entry);
                    }}
                  >
                    <ClassBlock
                      block={entry}
                      subject={entry.subject}
                      faculty={entry.faculty}
                      venue={entry.venue}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
