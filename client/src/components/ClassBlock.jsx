"use client";

import styles from "./ClassBlock.module.css";

/*
 * What each variant shows:
 *   course  → subject code, faculty, venue
 *   venue   → course, subject code, faculty      (everything except venue)
 *   faculty → course, subject code, venue        (everything except faculty)
 */
export default function ClassBlock({
  block,
  subject,
  faculty,
  venue,
  course,
  comboEntries = [],
  draggable = true,
  compact = false,
  variant = "course",
  onDragStart,
  onClick,
}) {
  // ---- subject ----
  const subjectObj =
    subject || (typeof block?.subjectId === "object" ? block.subjectId : null);

  const subjectCode = subjectObj?.subjectId || "Subject";

  // ---- faculty (show the faculty ID only) ----
  const facultyObj =
    faculty || (typeof block?.facultyId === "object" ? block.facultyId : null);

  const facultyCode = facultyObj?.facultyId || "Faculty";

  // ---- venue ----
  const venueObj =
    venue || (typeof block?.venueId === "object" ? block.venueId : null);

  const venueName = venueObj?.roomNo || venueObj?.name || "Venue";

  // ---- course ----
  const courseObj =
    course ||
    (typeof block?.course === "object" ? block.course : null) ||
    (typeof block?.courseId === "object" ? block.courseId : null);

  const courseDisplayId =
    courseObj?.courseId || courseObj?.code || courseObj?.name || "Course";

  // ---- combo ----
  const isCombo = Boolean(block?.comboGroupId);

  const comboCourseNames = comboEntries
    .map((entry) => entry.course)
    .filter(Boolean)
    .map((item) => item.courseId || item.code || item.name)
    .filter(Boolean);

  const comboSubjects = comboEntries
    .map((entry) => entry.subject)
    .filter(Boolean);

  const comboSubjectCodes = [
    ...new Set(comboSubjects.map((item) => item.subjectId).filter(Boolean)),
  ];

  // full details on hover (useful when text is clipped)
  const tooltip = [
    isCombo ? comboCourseNames.join(" + ") : courseDisplayId,
    isCombo ? comboSubjectCodes.join(" / ") : subjectCode,
    variant !== "faculty" ? `Faculty: ${facultyCode}` : "",
    variant !== "venue" ? `Venue: ${venueName}` : "",
    block?.duration > 1 ? `${block.duration} periods` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      className={`${styles.entry} ${styles[variant]} ${
        compact ? styles.compact : ""
      } ${draggable ? "" : styles.static}`}
      draggable={draggable}
      title={tooltip}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copyMove";

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
      {/* COMBO INDICATOR */}
      {isCombo && <span className={styles.comboBadge}>COMBO</span>}

      {/* MAIN COURSE TT — subject, faculty, venue */}
      {variant === "course" && (
        <>
          <strong>
            {isCombo ? comboCourseNames.join(" + ") : subjectCode}
          </strong>
          {isCombo && comboSubjectCodes.length > 0 && (
            <span>{comboSubjectCodes.join(" / ")}</span>
          )}
          <span>{facultyCode}</span>
          <span>{venueName}</span>
        </>
      )}

      {/* FACULTY TT — everything except the faculty */}
      {variant === "faculty" && (
        <>
          <strong>{courseDisplayId}</strong>
          <span>{subjectCode}</span>
          <span>{venueName}</span>
        </>
      )}

      {/* VENUE TT — everything except the venue */}
      {variant === "venue" && (
        <>
          <strong>{courseDisplayId}</strong>
          <span>{subjectCode}</span>
          <span>{facultyCode}</span>
        </>
      )}

      {block?.duration > 1 && (
        <span className={styles.duration}>{block.duration} periods</span>
      )}
    </button>
  );
}
