import styles from "./TabSwitcher.module.css";

const TABS = [
  { id: "course", label: "Course TT" },
  { id: "faculty", label: "Faculty TT" },
  { id: "venue", label: "Venue TT" },
];

export default function TabSwitcher({ active, onChange }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Timetable view">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`${styles.tab} ${active === tab.id ? styles.tabActive : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
