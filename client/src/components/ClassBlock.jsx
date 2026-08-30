"use client";

import styles from "./ClassBlock.module.css";

export default function ClassBlock({
  block,
  subject,
  faculty,
  venue,
  draggable = true,
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
          "application/json",
          JSON.stringify({
            kind: "class-block",
            id: block._id || block.id,
          }),
        );

        onDragStart?.(block);
      }}
      onClick={() => onClick?.(block)}
    >
      <div className={styles.top}>
        <strong>{subject?.name || "Subject"}</strong>

        {block.duration > 1 && (
          <span className={styles.duration}>{block.duration} periods</span>
        )}
      </div>

      {!compact && <span>{faculty?.name || "Faculty not assigned"}</span>}

      {!compact && (
        <span>{venue?.roomNo || venue?.name || "Venue not assigned"}</span>
      )}
    </button>
  );
}
