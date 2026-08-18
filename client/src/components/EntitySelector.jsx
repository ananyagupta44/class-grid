import styles from "./EntitySelector.module.css";

export default function EntitySelector({ label, options, value, onChange, getOptionLabel }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {getOptionLabel(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}
