"use client";

import { useEffect, useState } from "react";

import styles from "./GenerateTimetable.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/*
 * Admin dialog: automatically generate the timetable of a whole session.
 *
 * props
 *   open         show / hide
 *   onClose      close the dialog
 *   sessionId    id of the session to generate (all its courses)
 *   sessionLabel readable name, e.g. "2025-26"
 *   days         the DAYS your grid uses       (sent so ids always match)
 *   periodIds    the period ids your grid uses (e.g. ["p1", ... "p9"])
 *   onDone       called after a real (non dry-run) generation succeeds,
 *                use it to reload the timetable
 */
export default function GenerateTimetable({
  open,
  onClose,
  sessionId,
  sessionLabel,
  days = [],
  periodIds = [],
  onDone,
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null); // success payload
  const [failure, setFailure] = useState(null); // { message, errors, stuck }

  // start fresh every time the dialog opens
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setLoading(false);
      setResult(null);
      setFailure(null);
    }
  }, [open]);

  // elapsed-time counter while the server works
  useEffect(() => {
    if (!loading) return undefined;

    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    return () => clearInterval(timer);
  }, [loading]);

  // Esc closes (not while generating)
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !loading) onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  async function run(dryRun) {
    if (loading || !sessionId) return;

    setLoading(true);
    setResult(null);
    setFailure(null);

    try {
      const response = await fetch(`${API_URL}/timetable/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          sessionId,
          dryRun,
          config: { days, periodIds },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // 422 = the scheduler could not build a valid timetable
        setFailure({
          message:
            data.message ||
            (data.errors && data.errors[0]) ||
            "Could not generate the timetable.",
          errors: data.errors || [],
          stuck: data.stuck || [],
        });
        return;
      }

      setResult(data);

      if (!dryRun) await onDone?.();
    } catch (err) {
      setFailure({
        message: err.message || "Network error — is the server running?",
        errors: [],
        stuck: [],
      });
    } finally {
      setLoading(false);
    }
  }

  const finished = Boolean(result);

  return (
    <div className={styles.overlay} onClick={loading ? undefined : onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="gen-title">Auto-generate timetable</h3>

        {/* ---------- RESULT: SUCCESS ---------- */}
        {finished && (
          <>
            <div className={styles.success} role="status">
              {result.dryRun ? (
                <>
                  <strong>Looks good — nothing was saved.</strong>
                  <p>
                    A valid timetable with {result.count} classes can be built
                    for this session.
                  </p>
                </>
              ) : (
                <>
                  <strong>Timetable generated.</strong>
                  <p>
                    {result.count} classes scheduled
                    {result.removed
                      ? ` (replaced ${result.removed} existing classes)`
                      : ""}
                    .
                  </p>
                </>
              )}
            </div>

            {result.warnings?.length > 0 && (
              <ul className={styles.list}>
                {result.warnings.map((warning) => (
                  <li key={warning}>⚠ {warning}</li>
                ))}
              </ul>
            )}

            <div className={styles.actions}>
              {result.dryRun && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setResult(null)}
                >
                  Back
                </button>
              )}

              <button
                type="button"
                className={styles.primary}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* ---------- FORM / FAILURE / LOADING ---------- */}
        {!finished && (
          <>
            <p className={styles.lead}>
              Builds a clash-free timetable for <strong>every course</strong> in{" "}
              {sessionLabel ? `session ${sessionLabel}` : "this session"}. It
              respects faculty, rooms, room type (labs in lab rooms), capacity
              and each subject&apos;s L-T-P hours.
            </p>

            {failure && (
              <div className={styles.failure} role="alert">
                <strong>{failure.message}</strong>

                {failure.errors.length > 1 && (
                  <ul>
                    {failure.errors.slice(0, 8).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}

                {failure.stuck.length > 0 && (
                  <>
                    <p>Hardest to place:</p>
                    <ul>
                      {failure.stuck.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <label className={styles.confirm}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
              />
              <span>
                I understand this <strong>replaces the whole timetable</strong>{" "}
                of this session, including classes that were added or moved by
                hand.
              </span>
            </label>

            {loading && (
              <p className={styles.working} aria-live="polite">
                Generating… {seconds}s (large sessions can take a little while)
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.secondary}
                onClick={() => run(true)}
                disabled={loading || !sessionId}
                title="Run the generator without saving anything"
              >
                Check only
              </button>

              <button
                type="button"
                className={styles.primary}
                onClick={() => run(false)}
                disabled={loading || !confirmed || !sessionId}
              >
                {loading ? "Generating…" : "Generate & replace"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
