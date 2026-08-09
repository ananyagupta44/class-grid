import styles from "./dashboard.module.css";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const times = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"];

const mockEntries = {
  "Mon-09:00": { subject: "DSA", teacher: "Mehta", room: "R101" },
  "Mon-11:00": { subject: "OS Lab", teacher: "Rao", room: "Lab2" },
  "Tue-10:00": { subject: "DBMS", teacher: "Iyer", room: "R204" },
  "Wed-09:00": { subject: "DSA", teacher: "Mehta", room: "R101" },
  "Thu-14:00": { subject: "CN", teacher: "Sharma", room: "R101" },
  "Fri-11:00": { subject: "DBMS Lab", teacher: "Iyer", room: "Lab1" },
};

const stats = [
  { label: "Sections", value: "6" },
  { label: "Teachers", value: "14" },
  { label: "Rooms", value: "9" },
  { label: "Conflicts", value: "0" },
];

export default function Dashboard() {
  return (
    <div>
      <div className={styles.header}>
        <h1 className={`font-display ${styles.title}`}>BCA &ndash; III, Section A</h1>
        <p className={styles.subtitle}>
          Weekly schedule &middot; generated automatically, no clashes detected
        </p>
      </div>

      <div className={styles.statGrid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCard}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={`font-display ${styles.statValue}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className={styles.table}>
        <div className={styles.grid}>
          <div className={styles.cornerCell} />
          {days.map((d) => (
            <div key={d} className={styles.dayHeader}>
              {d}
            </div>
          ))}

          {times.map((t) => (
            <div key={t} className={styles.rowGroup}>
              <div className={`font-mono-time ${styles.timeCell}`}>{t}</div>
              {days.map((d) => {
                const entry = mockEntries[`${d}-${t}`];
                return (
                  <div key={`${d}-${t}`} className={styles.slotCell}>
                    {entry && (
                      <div className={styles.entry}>
                        <p className={styles.entrySubject}>{entry.subject}</p>
                        <p className={styles.entryMeta}>
                          {entry.teacher} &middot; {entry.room}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}