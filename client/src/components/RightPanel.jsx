"use client";

import { useEffect, useMemo, useState } from "react";

import MiniTimetable from "./MiniTimetable";
import styles from "./RightPanel.module.css";

/*
 * When was this timetable entry last created / changed?
 * Uses updatedAt / createdAt when the API sends them, otherwise the time
 * hidden inside a MongoDB _id (only the creation time, but better than nothing).
 */
function entryTime(entry) {
  const stamp = Date.parse(entry?.updatedAt || entry?.createdAt || "");

  if (!Number.isNaN(stamp)) return stamp;

  const id = String(entry?._id || entry?.id || "");

  return /^[0-9a-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : 0;
}

function lastUsed(card) {
  return (card.entries || []).reduce(
    (latest, entry) => Math.max(latest, entryTime(entry)),
    0,
  );
}

const byTitle = (a, b) =>
  String(a.title || "").localeCompare(String(b.title || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

// "recent": most recently used first (unused ones last), ties A–Z
// "alpha" : A–Z
function sortCards(cards, mode) {
  const list = [...cards];

  if (mode === "alpha") return list.sort(byTitle);

  const used = new Map(list.map((card) => [card, lastUsed(card)]));

  return list.sort((a, b) => used.get(b) - used.get(a) || byTitle(a, b));
}

// remembers each panel's choice separately in this browser
function useSortMode(storageKey) {
  const [mode, setMode] = useState("recent");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "recent" || saved === "alpha") setMode(saved);
    } catch {
      // storage unavailable: keep the default
    }
  }, [storageKey]);

  function choose(next) {
    setMode(next);

    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // ignore
    }
  }

  return [mode, choose];
}

// the little Recent | A–Z pill
function SortSwitch({ mode, onChange, label }) {
  return (
    <div
      className={styles.sortSwitch}
      data-mode={mode}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onChange("recent");
        if (event.key === "ArrowRight") onChange("alpha");
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "recent"}
        tabIndex={mode === "recent" ? 0 : -1}
        className={styles.sortOption}
        onClick={() => onChange("recent")}
        title="Most recently used first"
      >
        Recent
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === "alpha"}
        tabIndex={mode === "alpha" ? 0 : -1}
        className={styles.sortOption}
        onClick={() => onChange("alpha")}
        title="Alphabetical order"
      >
        A–Z
      </button>
    </div>
  );
}

export default function RightPanel({
  facultyCards = [],
  venueCards = [],
  days = [],
  periods = [],
  courses = [],
  faculties = [],
  venues = [],
  onDropBlock = null,
  onVenueCellClick = null,
  showFaculty = true, // false → only the venue panel (students)
  readOnly = false, // true → no dropping / clicking on the mini timetables
}) {
  // each panel has its own switch and remembers its own choice
  const [venueSort, setVenueSort] = useSortMode("rightPanelSort.venue");
  const [facultySort, setFacultySort] = useSortMode("rightPanelSort.faculty");

  const sortedVenues = useMemo(
    () => sortCards(venueCards, venueSort),
    [venueCards, venueSort],
  );

  const sortedFaculty = useMemo(
    () => sortCards(facultyCards, facultySort),
    [facultyCards, facultySort],
  );

  return (
    <aside className={styles.panelArea}>
      <div
        className={`${styles.panelInner} ${
          showFaculty ? "" : styles.singlePanel
        }`}
      >
        {/* ================= VENUE ================= */}
        <section className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            <div>
              {/* <span>Venue Timetables</span> */}
              <h2>Venue TT</h2>
              <small>
                {readOnly ? "All venue schedules" : "Drag class blocks here"}
              </small>
            </div>

            <SortSwitch
              mode={venueSort}
              onChange={setVenueSort}
              label="Sort venue timetables"
            />
          </div>

          <div className={styles.cards}>
            {sortedVenues.length > 0 ? (
              sortedVenues.map((card, index) => (
                <MiniTimetable
                  key={card.id || card.venueId || `venue-${index}`}
                  title={card.title}
                  subtitle={card.subtitle}
                  days={days}
                  periods={periods}
                  entries={card.entries || []}
                  courses={courses}
                  faculties={faculties}
                  venues={venues}
                  accent="venue"
                  {...(readOnly
                    ? {}
                    : {
                        acceptsDrop: true,
                        entityId: card.id,
                        onDropBlock,
                        onCellClick: (day, periodId) =>
                          onVenueCellClick?.(day, periodId, card.id),
                      })}
                />
              ))
            ) : (
              <p className={styles.empty}>
                Add a venue to start placing classes.
              </p>
            )}
          </div>
        </section>

        {/* ================= FACULTY ================= */}
        {showFaculty && (
          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                {/* <span>Faculty Timetables</span> */}
                <h2>Faculty TT</h2>
                <small>All faculty schedules</small>
              </div>

              <SortSwitch
                mode={facultySort}
                onChange={setFacultySort}
                label="Sort faculty timetables"
              />
            </div>

            <div className={styles.cards}>
              {sortedFaculty.length > 0 ? (
                sortedFaculty.map((card, index) => (
                  <MiniTimetable
                    key={card.id || card.facultyId || `faculty-${index}`}
                    title={card.title}
                    subtitle={card.subtitle}
                    days={days}
                    periods={periods}
                    entries={card.entries || []}
                    courses={courses}
                    faculties={faculties}
                    venues={venues}
                    accent="faculty"
                  />
                ))
              ) : (
                <p className={styles.empty}>
                  Faculty schedules will appear here.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
