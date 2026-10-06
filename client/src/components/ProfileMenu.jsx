"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import styles from "./ProfileMenu.module.css";

const ROLE_LABEL = {
  admin: "Admin",
  staff: "Faculty",
  student: "Student",
};

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (!user) return null;

  const isStudent = user.role === "student";

  function show() {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }

  // small delay so the card doesn't vanish while the pointer crosses the gap
  function hideSoon() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function handleLogout() {
    setOpen(false);
    logout();
    router.push("/");
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        type="button"
        className={styles.avatar}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Profile: ${user.name}`}
        onClick={() => setOpen((prev) => !prev)}
        onFocus={show}
      >
        {initials(user.name)}
      </button>

      {open && (
        <div className={styles.card} role="menu">
          <div className={styles.head}>
            <span className={styles.bigAvatar} aria-hidden="true">
              {initials(user.name)}
            </span>

            <div className={styles.who}>
              <strong>{user.name}</strong>
              <span className={styles.role}>
                {ROLE_LABEL[user.role] || user.role}
              </span>
            </div>
          </div>

          <dl className={styles.details}>
            <div>
              <dt>{isStudent ? "Roll number" : "Staff ID"}</dt>
              <dd>{user.identifier}</dd>
            </div>

            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>

          <button
            type="button"
            className={styles.logout}
            role="menuitem"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
