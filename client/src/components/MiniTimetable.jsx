"use client";

import { useMemo, useState } from "react";

import ClassBlock from "./ClassBlock";
import { spanFor, useDragPayload } from "./dragState";
import styles from "./MiniTimetable.module.css";

const shortDay = (day) => String(day || "").slice(0, 3);

// "09:00 - 09:50" → "09:00"
const startTime = (label) =>
  String(label || "")
    .split("-")[0]
    .trim();

/*
 * The small timetable card in the right panel (one per venue / faculty).
 *
 * props (as used by RightPanel)
 *   title, subtitle     heading of the card
 *   days, periods       the grid
 *   entries             this venue's / faculty's classes
 *   accent              "venue" | "faculty"
 *   acceptsDrop         venue cards: classes can be dropped on the cells
 *                       (and the blocks in them dragged out again)
 *   entityId            the venue's id, handed back on a drop
 *   onDropBlock(payload, day, periodId, entityId)
 *   onCellClick(day, periodId)
 *
 * While ANY class is being dragged the cells of a drop-enabled card light up,
 * and the cells under the pointer are highlighted — as many as the class
 * needs (a 3-period lab lights 3), in red when it would not fit in the day.
 */
export default function MiniTimetable({
  title,
  subtitle,
  days = [],
  periods = [],
  entries = [],
  accent = "venue",
  acceptsDrop = false,
  entityId,
  onDropBlock,
  onCellClick,
}) {
  const drag = useDragPayload();

  // { day, index } of the cell under the pointer while dragging
  const [over, setOver] = useState(null);

  const rowTemplate = `1.9rem repeat(${periods.length}, minmax(0, 1fr))`;

  // per day: the blocks to draw (a combo is ONE block, however many courses)
  const blocksByDay = useMemo(() => {
    const result = new Map();

    for (const day of days) {
      const list = entries.filter((entry) => entry.day === day);
      const seen = new Set();
      const blocks = [];

      for (const entry of list) {
        if (entry.comboGroupId) {
          if (seen.has(entry.comboGroupId)) continue;

          seen.add(entry.comboGroupId);

          blocks.push({
            entry,
            group: list.filter(
              (item) => item.comboGroupId === entry.comboGroupId,
            ),
          });
        } else {
          blocks.push({ entry, group: null });
        }
      }

      result.set(day, blocks);
    }

    return result;
  }, [entries, days]);

  function cellClass(day, index) {
    const classes = [styles.cell];

    if (acceptsDrop && drag) classes.push(styles.dropReady);

    if (acceptsDrop && drag && over && over.day === day) {
      const { from, to, bad } = spanFor(drag, over.index, periods.length);

      if (index >= from && index <= to) {
        classes.push(bad ? styles.cellBad : styles.cellOver);
      }
    }

    return classes.join(" ");
  }

  function handleDrop(event, day, periodId) {
    event.preventDefault();
    setOver(null);

    let payload = null;

    try {
      payload = JSON.parse(
        event.dataTransfer.getData("application/json") || "null",
      );
    } catch {
      payload = null;
    }

    if (payload) onDropBlock?.(payload, day, periodId, entityId);
  }

  return (
    <section
      className={`${styles.card} ${
        accent === "venue" ? styles.venue : styles.faculty
      }`}
    >
      <header className={styles.head}>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </header>

      <div className={styles.table}>
        <div
          className={styles.row}
          style={{ gridTemplateColumns: rowTemplate }}
        >
          <div className={styles.corner} />

          {periods.map((period, index) => (
            <div
              key={period.id}
              className={styles.periodHead}
              style={{ gridColumn: index + 2 }}
              title={period.label}
            >
              {startTime(period.label)}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day}
            className={`${styles.row} ${styles.dayRow}`}
            style={{ gridTemplateColumns: rowTemplate }}
          >
            <div className={styles.dayCell} style={{ gridColumn: 1 }}>
              {shortDay(day)}
            </div>

            {periods.map((period, index) => (
              <div
                key={period.id}
                className={cellClass(day, index)}
                style={{ gridColumn: index + 2, gridRow: 1 }}
                {...(acceptsDrop
                  ? {
                      onDragEnter: (event) => {
                        event.preventDefault();
                        setOver({ day, index });
                      },
                      onDragOver: (event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";

                        setOver((current) =>
                          current?.day === day && current?.index === index
                            ? current
                            : { day, index },
                        );
                      },
                      onDragLeave: (event) => {
                        if (
                          !event.currentTarget.contains(event.relatedTarget)
                        ) {
                          setOver((current) =>
                            current?.day === day && current?.index === index
                              ? null
                              : current,
                          );
                        }
                      },
                      onDrop: (event) => handleDrop(event, day, period.id),
                    }
                  : {})}
                onClick={() => onCellClick?.(day, period.id)}
              />
            ))}

            {/* the classes, laid over the cells of their periods */}
            {(blocksByDay.get(day) || []).map(({ entry, group }) => {
              const start = periods.findIndex(
                (period) => period.id === entry.periodId,
              );

              if (start < 0) return null;

              const duration = Math.max(1, Number(entry.duration) || 1);

              return (
                <div
                  key={entry.comboGroupId || entry._id || entry.id}
                  className={styles.block}
                  style={{
                    gridColumn: `${start + 2} / span ${duration}`,
                    gridRow: 1,
                  }}
                >
                  <ClassBlock
                    block={entry}
                    subject={entry.subject}
                    faculty={entry.faculty}
                    venue={entry.venue}
                    course={entry.course}
                    comboEntries={group || []}
                    variant={accent}
                    compact
                    draggable={acceptsDrop}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
