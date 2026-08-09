"use client";

import { useEffect, useState } from "react";
import { useLoginSidebar } from "../context/LoginSidebarContext";
import styles from "./LoginSidebar.module.css";

const roleCopy = {
  student: { title: "Student Login", sub: "Check your section's weekly schedule.", idLabel: "Roll number" },
  admin: { title: "Admin / Staff Login", sub: "Manage staff, subjects and generated timetables.", idLabel: "Staff ID" },
  staff: { title: "Staff Login", sub: "View your assigned classes and rooms.", idLabel: "Staff ID" },
};

export default function LoginSidebar() {
  const { isOpen, role, closeLogin } = useLoginSidebar();
  const copy = roleCopy[role] ?? roleCopy.student;

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeLogin();
    }
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeLogin]);

  function handleSubmit(e) {
    e.preventDefault();
    // wire up real auth here
    closeLogin();
  }

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ""}`}
        onClick={closeLogin}
        aria-hidden={!isOpen}
      />
      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        <button className={styles.close} onClick={closeLogin} aria-label="Close login panel">
          ✕
        </button>

        <p className="font-mono-time" style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--marigold-dark)", textTransform: "uppercase" }}>
          ClassGrid
        </p>
        <h2 className={`font-display ${styles.title}`}>{copy.title}</h2>
        <p className={styles.sub}>{copy.sub}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{copy.idLabel}</span>
            <input type="text" name="identifier" required autoFocus={isOpen} />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input type="password" name="password" required />
          </label>

          <button type="submit" className={styles.submit}>
            Log in
          </button>
        </form>

        <p className={styles.footNote}>
          New here?{" "}
          <a href="/register" onClick={closeLogin}>
            Create an account
          </a>
        </p>
      </aside>
    </>
  );
}