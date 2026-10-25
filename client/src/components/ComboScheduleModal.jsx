"use client";

import { useEffect, useMemo, useState } from "react";

import { isLabRoom } from "./legendBlocks";
import styles from "./ComboModal.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const norm = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/*
 * Places ONE block of a combo on the timetable: choose the venue, confirm.
 *
 * props
 *   combo        populated combo (GET /combos)
 *   placement    { day, periodId, blockType: "lecture" | "lab", duration }
 *   periodLabel  e.g. "09:00 - 09:50"
 *   venues       every room
 *   onClose, onDone
 */
export default function ComboScheduleModal({
  combo,
  placement,
  periodLabel,
  venues = [],
  onClose,
  onDone,
}) {
  const [venueId, setVenueId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const wantLab = placement?.blockType === "lab";

  const students = (combo?.members || []).reduce(
    (total, member) => total + (Number(member.course?.noOfStudents) || 0),
    0,
  );

  // rooms that suit this block: right kind, big enough, right lab category
  const rooms = useMemo(() => {
    const need = norm(combo?.members?.[0]?.subject?.requiredRoomCategory);

    const categoryExists =
      wantLab &&
      need &&
      venues.some((room) => isLabRoom(room) && norm(room.category) === need);

    return venues
      .filter(
        (room) =>
          isLabRoom(room) === wantLab &&
          (!students || room.capacity >= students) &&
          (!categoryExists || norm(room.category) === need),
      )
      .sort((a, b) => a.capacity - b.capacity);
  }, [combo, venues, wantLab, students]);

  useEffect(() => {
    setVenueId(rooms[0]?._id || "");
    setError("");
  }, [rooms, combo, placement]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  if (!combo || !placement) return null;

  async function place() {
    if (!venueId || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/combos/${combo._id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          day: placement.day,
          periodId: placement.periodId,
          venueId,
          duration: placement.duration,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.message || "Could not schedule");

      await onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={saving ? undefined : onClose}>
      <div
        className={`${styles.dialog} ${styles.narrow}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-place-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <h3 id="combo-place-title">Schedule combo class</h3>

          <p>
            <strong>{combo.name}</strong> — {combo.members.length} courses
            together ({students} students).
          </p>
        </div>

        <dl className={styles.facts}>
          <div>
            <dt>When</dt>
            <dd>
              {placement.day}, {periodLabel || placement.periodId}
              {placement.duration > 1 ? ` (${placement.duration} periods)` : ""}
            </dd>
          </div>

          <div>
            <dt>Courses</dt>
            <dd>{combo.members.map((m) => m.course?.courseId).join(", ")}</dd>
          </div>

          <div>
            <dt>Faculty</dt>
            <dd>{combo.faculty?.name}</dd>
          </div>
        </dl>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span>{wantLab ? "Lab room" : "Classroom"}</span>

          {rooms.length > 0 ? (
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.roomNo} — seats {room.capacity}
                  {room.category ? ` · ${room.category}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className={styles.error}>
              No {wantLab ? "lab" : "classroom"} seats {students} students. Add
              a bigger room on the Home page first.
            </p>
          )}
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className={styles.primary}
            onClick={place}
            disabled={!venueId || saving}
          >
            {saving ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
