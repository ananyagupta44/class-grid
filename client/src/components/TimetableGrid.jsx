"use client";

import { useEffect, useState } from "react";
import ClassBlock from "./ClassBlock";
import styles from "./TimetableGrid.module.css";

export default function TimetableGrid({
  days = [],
  periods = [],
  entries = [],
  courses = [],
  faculties = [],
  venues = [],
  variant = "course",
  placing = false,
  onDropEntry,
  onLegendDrop,
  onCellClick,
  onEditEntry,
}) {
  // Wider columns so period timings stay readable.
  const DAY_COL = 72;
  const PERIOD_COL = 90;

  // SAME template string + min-width used for the header row AND every day row.
  const rowTemplate = `${DAY_COL}px repeat(${periods.length}, minmax(${PERIOD_COL}px, 1fr))`;
  const rowStyle = {
    gridTemplateColumns: rowTemplate,
    minWidth: `${DAY_COL + periods.length * PERIOD_COL}px`,
  };

  // cell currently hovered by a drag ("day|periodId")
  const [dragOverKey, setDragOverKey] = useState("");

  // today's weekday (set after mount to avoid server/client mismatch)
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(),
    );
  }, []);

  function isToday(day) {
    if (!today || !day) return false;
    const d = String(day).toLowerCase();
    return d === today || today.startsWith(d.slice(0, 3));
  }

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
    setDragOverKey("");

    try {
      const raw =
        event.dataTransfer.getData("application/json") ||
        event.dataTransfer.getData("text/plain");

      if (!raw) {
        console.log("NO DRAG DATA");
        return;
      }

      const payload = JSON.parse(raw);

      console.log("TIMETABLE DROP PAYLOAD:", payload);

      // ==========================================
      // FACULTY LEGEND → CREATE NEW CLASS
      // ==========================================
      if (payload.kind === "legend") {
        onLegendDrop?.(payload, day, periodId);
        return;
      }

      // ==========================================
      // EXISTING CLASS → MOVE CLASS
      // ==========================================
      if (payload.kind === "class-block") {
        console.log("🔥 MOVING CLASS:", {
          id: payload.id,
          day,
          periodId,
        });

        return onDropEntry?.(payload.id, day, periodId);
      }
    } catch (error) {
      console.error("TIMETABLE DROP:", error);
    }
  }

  return (
    <div className={`${styles.table} ${placing ? styles.placing : ""}`}>
      {/* HEADER — column 1 is the TIME corner, columns 2..n+1 are periods */}

      <div className={styles.headerRow} style={rowStyle}>
        <div className={styles.corner} style={{ gridColumn: 1 }}>
          TIME
        </div>

        {periods.map((period, index) => (
          <div
            key={period.id}
            className={styles.periodHeader}
            style={{ gridColumn: index + 2 }}
          >
            {period.label}
          </div>
        ))}
      </div>

      {/* DAYS — each day row is its OWN flat grid */}

      {days.map((day) => {
        const dayEntries = entries.filter((entry) => entry.day === day);

        return (
          <div
            key={day}
            className={`${styles.dayRow} ${isToday(day) ? styles.todayRow : ""}`}
            style={rowStyle}
          >
            {/* DAY */}

            <div className={styles.dayCell} style={{ gridColumn: 1 }}>
              {day}
            </div>

            {/* EMPTY / DROP CELLS */}

            {periods.map((period, index) => {
              const entry = getEntry(day, period.id);

              return (
                <div
                  key={period.id}
                  className={`${styles.slotCell} ${
                    dragOverKey === `${day}|${period.id}`
                      ? styles.slotCellOver
                      : ""
                  }`}
                  style={{
                    gridColumn: index + 2,
                    gridRow: 1,
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOverKey(`${day}|${period.id}`);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    setDragOverKey(`${day}|${period.id}`);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setDragOverKey((key) =>
                        key === `${day}|${period.id}` ? "" : key,
                      );
                    }
                  }}
                  onDrop={(event) => {
                    handleDrop(event, day, period.id);
                  }}
                  onClick={() => onCellClick?.(day, period.id)}
                >
                  {!entry && <span className={styles.addHint}>+</span>}
                </div>
              );
            })}

            {/* CLASS BLOCKS */}

            {(() => {
              const renderedCombos = new Set();

              return dayEntries.map((entry) => {
                // ==========================================
                // COMBO CLASS
                // ==========================================

                if (entry.comboGroupId) {
                  if (renderedCombos.has(entry.comboGroupId)) {
                    return null;
                  }

                  renderedCombos.add(entry.comboGroupId);

                  const comboEntries = dayEntries.filter(
                    (item) => item.comboGroupId === entry.comboGroupId,
                  );

                  const comboEntry = comboEntries[0];

                  const startIndex = getPeriodIndex(comboEntry.periodId);

                  if (startIndex < 0) {
                    return null;
                  }

                  const duration = Math.max(
                    1,
                    Number(comboEntry.duration) || 1,
                  );

                  return (
                    <div
                      key={comboEntry.comboGroupId}
                      className={styles.entryPosition}
                      style={{
                        gridColumn: `${startIndex + 2} / span ${duration}`,
                        gridRow: 1,
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditEntry?.(comboEntry);
                      }}
                    >
                      <ClassBlock
                        block={comboEntry}
                        subject={comboEntry.subject}
                        faculty={comboEntry.faculty}
                        venue={comboEntry.venue}
                        course={comboEntry.course}
                        variant={variant}
                        comboEntries={comboEntries}
                      />
                    </div>
                  );
                }

                // ==========================================
                // NORMAL CLASS
                // ==========================================

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
                      gridColumn: `${startIndex + 2} / span ${duration}`,
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
                      course={entry.course}
                      variant={variant}
                    />
                  </div>
                );
              });
            })()}
          </div>
        );
      })}
    </div>
  );
}
