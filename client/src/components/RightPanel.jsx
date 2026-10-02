"use client";

import MiniTimetable from "./MiniTimetable";
import styles from "./RightPanel.module.css";

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
}) {
  return (
    <aside className={styles.panelArea}>
      <div className={styles.panelInner}>
      {/* ================= FACULTY ================= */}
      <section className={styles.sidePanel}>
        <div className={styles.panelHeader}>
          <div>
            {/* <span>Faculty Timetables</span> */}
            <h2>Faculty TT</h2>
          </div>

          <small>All faculty schedules</small>
        </div>

        <div className={styles.cards}>
          {facultyCards.length > 0 ? (
            facultyCards.map((card, index) => (
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
            <p className={styles.empty}>Faculty schedules will appear here.</p>
          )}
        </div>
      </section>

      {/* ================= VENUE ================= */}
      <section className={styles.sidePanel}>
        <div className={styles.panelHeader}>
          <div>
            {/* <span>Venue Timetables</span> */}
            <h2>Venue TT</h2>
          </div>

          <small>Drag class blocks here</small>
        </div>

        <div className={styles.cards}>
          {venueCards.length > 0 ? (
            venueCards.map((card, index) => (
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
                acceptsDrop
                entityId={card.id}
                onDropBlock={onDropBlock}
                onCellClick={(day, periodId) =>
                  onVenueCellClick?.(day, periodId, card.id)
                }
              />
            ))
          ) : (
            <p className={styles.empty}>
              Add a venue to start placing classes.
            </p>
          )}
        </div>
      </section>
      </div>
    </aside>
  );
}