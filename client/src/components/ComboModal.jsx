"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./ComboModal.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.data = data;
    throw error;
  }

  return data;
}

const ltpText = (ltp = []) => [0, 1, 2].map((i) => ltp[i] ?? 0).join("-");

const isLabOnly = (item) =>
  item.type === "lab" ||
  (item.ltp?.[2] > 0 && !item.ltp?.[0] && !item.ltp?.[1]);

/*
 * "Create combo" dialog.
 *
 * A combo = several courses attending ONE class together. The rules:
 * the same faculty, the same L-T-P hours, all lab or all theory, each course
 * at most once, and a subject can only be in one combo.
 *
 * props: open, onClose, sessionId, currentCourseId, onChanged
 */
export default function ComboModal({
  open,
  onClose,
  sessionId,
  currentCourseId,
  onChanged,
}) {
  const [tab, setTab] = useState("create");
  const [items, setItems] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]); // "courseDbId|subjectDbId"
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null); // { id, scheduled }

  async function load() {
    if (!sessionId) return;

    setLoading(true);
    setError("");

    try {
      const [options, list] = await Promise.all([
        request(`/combos/options?sessionId=${sessionId}`),
        request(`/combos?sessionId=${sessionId}`),
      ]);

      setItems(options.items || []);
      setCombos(list.combos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // fresh start each time it opens
  useEffect(() => {
    if (!open) return;

    setTab("create");
    setQuery("");
    setPicked([]);
    setName("");
    setConfirmDelete(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const keyOf = (item) => `${item.courseDbId}|${item.subjectDbId}`;

  const chosen = useMemo(
    () => items.filter((item) => picked.includes(keyOf(item))),
    [items, picked],
  );

  // why a row cannot be chosen right now ("" = it can)
  function blockedReason(item) {
    if (picked.includes(keyOf(item))) return "";

    if (item.inCombo) return `Already in combo "${item.inComboName || "…"}"`;

    if (!item.facultyDbId) return "Assign a faculty to this subject first";

    if (chosen.some((c) => c.courseDbId === item.courseDbId))
      return "This course is already in the combo";

    const first = chosen[0];

    if (first) {
      if (first.facultyDbId !== item.facultyDbId)
        return `Taught by a different faculty (needs ${first.facultyName})`;

      if (ltpText(first.ltp) !== ltpText(item.ltp))
        return `Different L-T-P (needs ${ltpText(first.ltp)})`;

      if (isLabOnly(first) !== isLabOnly(item))
        return isLabOnly(first)
          ? "Needs a lab subject"
          : "Needs a theory subject";
    }

    return "";
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (
      items
        .filter(
          (item) =>
            !q ||
            [
              item.courseId,
              item.subjectCode,
              item.subjectName,
              item.facultyName,
              item.facultyCode,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q),
        )
        // the course you are working on first
        .sort(
          (a, b) =>
            Number(b.courseDbId === currentCourseId) -
            Number(a.courseDbId === currentCourseId),
        )
    );
  }, [items, query, currentCourseId]);

  const students = chosen.reduce(
    (t, item) => t + (Number(item.students) || 0),
    0,
  );

  function toggle(item) {
    const key = keyOf(item);

    setPicked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function create() {
    if (chosen.length < 2 || saving) return;

    setSaving(true);
    setError("");

    try {
      await request("/combos", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          members: chosen.map((item) => ({
            courseId: item.courseDbId,
            subjectId: item.subjectDbId,
          })),
        }),
      });

      await onChanged?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id, removeClasses = false) {
    setError("");

    try {
      await request(
        `/combos/${id}${removeClasses ? "?removeClasses=true" : ""}`,
        {
          method: "DELETE",
        },
      );

      setConfirmDelete(null);
      await load();
      await onChanged?.();
    } catch (err) {
      if (err.data?.scheduled) {
        setConfirmDelete({ id, scheduled: err.data.scheduled });
      } else {
        setError(err.message);
      }
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={saving ? undefined : onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <h3 id="combo-title">Combo classes</h3>

          <p>
            A combo is one class attended by several courses together. Pick the
            subjects that are taught together — two, three or more.
          </p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "create"}
            className={tab === "create" ? styles.tabOn : ""}
            onClick={() => setTab("create")}
          >
            Create combo
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "existing"}
            className={tab === "existing" ? styles.tabOn : ""}
            onClick={() => setTab("existing")}
          >
            Existing combos ({combos.length})
          </button>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {loading && <p className={styles.muted}>Loading…</p>}

        {/* ================= CREATE ================= */}
        {tab === "create" && !loading && (
          <>
            <input
              type="search"
              className={styles.search}
              placeholder="Search course, subject or faculty…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />

            <ul className={styles.list}>
              {visible.length === 0 && (
                <li className={styles.none}>No subjects to show.</li>
              )}

              {visible.map((item) => {
                const reason = blockedReason(item);
                const on = picked.includes(keyOf(item));

                return (
                  <li key={keyOf(item)}>
                    <label
                      className={`${styles.row} ${on ? styles.rowOn : ""} ${
                        reason ? styles.rowOff : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={Boolean(reason)}
                        onChange={() => toggle(item)}
                      />

                      <span className={styles.main}>
                        <strong>{item.courseId}</strong>
                        <span>
                          {item.subjectCode} — {item.subjectName}
                        </span>

                        {reason && <em>{reason}</em>}
                      </span>

                      <span className={styles.meta}>
                        <span>{ltpText(item.ltp)}</span>
                        <span>{item.students} students</span>
                        <span>{item.facultyName || "No faculty"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className={styles.summary}>
              {chosen.length === 0 ? (
                <span>Select at least two subjects.</span>
              ) : (
                <span>
                  <strong>{chosen.length}</strong> selected · {students}{" "}
                  students together · {chosen[0].facultyName} ·{" "}
                  {ltpText(chosen[0].ltp)}
                </span>
              )}
            </div>

            <input
              type="text"
              className={styles.search}
              placeholder={
                chosen.length
                  ? `Name (optional) — default: ${[
                      ...new Set(chosen.map((c) => c.subjectCode)),
                    ].join(" + ")}`
                  : "Name (optional)"
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.primary}
                onClick={create}
                disabled={chosen.length < 2 || saving}
              >
                {saving ? "Creating…" : "Create combo"}
              </button>
            </div>
          </>
        )}

        {/* ================= EXISTING ================= */}
        {tab === "existing" && !loading && (
          <>
            <ul className={styles.list}>
              {combos.length === 0 && (
                <li className={styles.none}>No combos in this session yet.</li>
              )}

              {combos.map((combo) => (
                <li key={combo._id} className={styles.comboCard}>
                  <div>
                    <strong>{combo.name}</strong>

                    <p>
                      {combo.members
                        .map(
                          (member) =>
                            `${member.course?.courseId} · ${member.subject?.subjectId}`,
                        )
                        .join("  +  ")}
                    </p>

                    <small>
                      {combo.faculty?.name} ·{" "}
                      {ltpText(combo.members[0]?.subject?.ltp)}
                    </small>
                  </div>

                  {confirmDelete?.id === combo._id ? (
                    <div className={styles.confirm}>
                      <span>
                        {confirmDelete.scheduled} class entr
                        {confirmDelete.scheduled === 1 ? "y is" : "ies are"} on
                        the timetable. Delete everything?
                      </span>

                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => remove(combo._id, true)}
                      >
                        Delete combo + classes
                      </button>

                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setConfirmDelete(null)}
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => remove(combo._id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className={styles.actions}>
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
      </div>
    </div>
  );
}
