"use client";

import { useEffect } from "react";
import styles from "./Modal.module.css";

export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;

    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.panel}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h3 className={`font-display ${styles.title}`}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
