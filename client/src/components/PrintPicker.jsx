"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./PrintPicker.module.css";

/*
 * Dialog that lets the user choose which faculty / venue timetables
 * to download. items: [{ id, label, sublabel }]
 */
export default function PrintPicker({
  title = "Download timetables",
  noun = "timetables",
  items = [],
  onCancel,
  onConfirm,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) =>
      [item.label, item.sublabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((item) => selected.has(item.id));

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onCancel?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((item) => next.delete(item.id));
      else visible.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function confirm() {
    // keep the original list order
    const ids = items
      .filter((item) => selected.has(item.id))
      .map((item) => item.id);
    if (ids.length) onConfirm?.(ids);
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <h3 id="print-picker-title">{title}</h3>
          <p>
            Choose which {noun} to include. Each one is printed on its own page.
          </p>
        </div>

        <input
          type="text"
          className={styles.search}
          placeholder={`Search ${noun}...`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visible.length === 0}
            />
            <span>{query ? "Select all shown" : "Select all"}</span>
          </label>

          <span className={styles.count}>
            {selected.size} of {items.length} selected
          </span>
        </div>

        <ul className={styles.list}>
          {visible.length === 0 && (
            <li className={styles.none}>
              Nothing matches &quot;{query}&quot;.
            </li>
          )}

          {visible.map((item) => (
            <li key={item.id}>
              <label
                className={`${styles.row} ${
                  selected.has(item.id) ? styles.rowOn : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />

                <span className={styles.label}>{item.label}</span>

                {item.sublabel && (
                  <span className={styles.sublabel}>{item.sublabel}</span>
                )}
              </label>
            </li>
          ))}
        </ul>

        <p className={styles.tip}>
          In the print window, choose &quot;Save as PDF&quot; as the
          destination.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>

          <button
            type="button"
            className={styles.confirm}
            onClick={confirm}
            disabled={selected.size === 0}
          >
            Download PDF{selected.size ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
