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
  onDropBlock = [],
}) {
  return (
    <aside className={styles.panelArea}>
      <section className={styles.sidePanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Faculty Timetables</span>
            <h2>Faculty TT</h2>
          </div>
          <small>Hover to expand</small>
        </div>

        <div className={styles.cards}>
          {facultyCards.length ? (
            facultyCards.map((card) => (
              <MiniTimetable
                key={card.id}
                title={card.title}
                subtitle={card.subtitle}
                days={days}
                periods={periods}
                entries={card.entries}
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

      <section className={styles.sidePanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Venue Timetables</span>
            <h2>Venue TT</h2>
          </div>
          <small>Drag class blocks here</small>
        </div>

        <div className={styles.cards}>
          {venueCards.length ? (
            venueCards.map((card) => (
              <MiniTimetable
                key={card.id}
                title={card.title}
                subtitle={card.subtitle}
                days={days}
                periods={periods}
                entries={card.entries}
                courses={courses}
                faculties={faculties}
                venues={venues}
                accent="venue"
                acceptsDrop
                entityId={card.id}
                onDropBlock={onDropBlock}
              />
            ))
          ) : (
            <p className={styles.empty}>
              Add a venue to start placing classes.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
