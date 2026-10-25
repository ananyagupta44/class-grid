"use client";

import { useEffect, useState } from "react";

import styles from "./ChangePasswordModal.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const MIN_LENGTH = 8;

/*
 * Lets the logged-in user change their own password.
 * Usage:  {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
 */
export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Esc closes the dialog
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // close by itself shortly after success
  useEffect(() => {
    if (!done) return undefined;

    const timer = setTimeout(onClose, 1800);

    return () => clearTimeout(timer);
  }, [done, onClose]);

  async function submit(event) {
    event.preventDefault();

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the current one.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },

        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Could not change the password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not change the password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className={styles.header}>
          <h2 id="change-password-title">Change password</h2>

          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {done ? (
          <p className={styles.success} role="status">
            Your password has been changed.
          </p>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <label>
              Current password
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>

            <label>
              New password
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
              />
            </label>

            <label>
              Confirm new password
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            <label className={styles.showRow}>
              <input
                type="checkbox"
                checked={show}
                onChange={(event) => setShow(event.target.checked)}
              />
              Show passwords
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancel}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <button type="submit" className={styles.save} disabled={submitting}>
                {submitting ? "Saving..." : "Change password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
