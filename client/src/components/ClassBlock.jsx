"use client";

import styles from "./ClassBlock.module.css";

export default function ClassBlock({
  block,
  subject,
  faculty,
  venue,
  draggable = false,
  compact = false,
  onDragStart,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`${styles.entry} ${compact ? styles.compact : ""}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ kind: "class-block", id: block.id }),
        );
        onDragStart?.(block);
      }}
      onClick={() => onClick?.(block)}
    >
      <div className={styles.top}>
        <strong>{subject?.name || "Subject"}</strong>
        <span className={styles.kind}>{block.kind}</span>
      </div>

      {!compact && <span>{faculty?.name || "Faculty not assigned"}</span>}
      {!compact && <span>{venue?.name || "Venue not assigned"}</span>}
    </button>
  );
}
