import styles from "./EntityList.module.css";

const SUBTITLE_BUILDERS = {
  course: (item) => `${item.code} \u00b7 Semester ${item.semester}`,
  faculty: (item) => `${item.dept} \u00b7 ${item.email}`,
  venue: (item) => `${item.type} \u00b7 Seats ${item.capacity}`,
};

export default function EntityList({ type, items, onDelete, disabledMap }) {
  const subtitleFor = SUBTITLE_BUILDERS[type];

  if (!items.length) {
    return <p className={styles.empty}>No {type}s added yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const inUse = disabledMap?.[item.id];
        return (
          <li key={item.id} className={styles.row}>
            <div>
              <p className={styles.title}>{item.name}</p>
              <p className={styles.subtitle}>{subtitleFor(item)}</p>
            </div>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(item.id)}
              disabled={inUse}
              title={inUse ? "Remove this from the timetable first" : "Delete"}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
