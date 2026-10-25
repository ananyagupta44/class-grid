"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { can } from "../../context/permissions";
import styles from "./audit.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const PAGE_SIZE = 25;

// "2026-10-13" in the user's own calendar
const isoDay = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("sv-SE");
};

const authHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function apiRequest(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data?.message || "Request failed");

  return data;
}

const formatTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const showValue = (v) => {
  if (v === null || v === undefined || v === "") return "empty";
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
};

const ACTION_CLASS = {
  create: "actionCreate",
  update: "actionUpdate",
  delete: "actionDelete",
};

function Changes({ row }) {
  if (row.changes?.length) {
    const shown = row.changes.slice(0, 4);

    return (
      <ul className={styles.changes}>
        {shown.map((c) => (
          <li key={c.field}>
            <strong>{c.field}</strong>
            <span className={styles.from}>{showValue(c.from)}</span>
            <span aria-hidden="true">&rarr;</span>
            <span className={styles.to}>{showValue(c.to)}</span>
          </li>
        ))}
        {row.changes.length > shown.length && (
          <li className={styles.more}>+{row.changes.length - shown.length} more fields</li>
        )}
      </ul>
    );
  }

  if (row.action === "create") return <span className={styles.muted}>New record created</span>;
  if (row.action === "delete") return <span className={styles.muted}>Record deleted</span>;

  return <span className={styles.muted}>{row.summary || ""}</span>;
}

export default function AuditLogPage() {
  const { user, ready: authReady } = useAuth();
  const allowed = authReady && can(user?.role, "viewAuditLog");

  const [from, setFrom] = useState(isoDay(7));
  const [to, setTo] = useState(isoDay(0));
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [options, setOptions] = useState({ entities: [], actions: [] });
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  // wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!allowed) return;

    apiRequest("/audit/filters")
      .then(setOptions)
      .catch(() => {});
  }, [allowed]);

  // the same filters are used for the list and for the downloaded report
  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();

    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (entity) p.set("entity", entity);
    if (action) p.set("action", action);
    if (search) p.set("q", search);

    return p;
  }, [from, to, entity, action, search]);

  useEffect(() => {
    if (!allowed) return undefined;

    let cancelled = false;

    setLoading(true);
    setError("");

    apiRequest(`/audit?${filterQuery}&page=${page}&limit=${PAGE_SIZE}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [allowed, filterQuery, page]);

  const changeFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  async function download(format) {
    setDownloading(format);
    setError("");

    try {
      const response = await fetch(`${API_URL}/audit/export?${filterQuery}&format=${format}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || "Could not create the report");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `audit-report_${from || "start"}_to_${to || "today"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading("");
    }
  }

  if (!authReady) return <div className={styles.state}>Loading…</div>;

  if (!allowed) {
    return (
      <div className={styles.state}>
        <h1>No access</h1>
        <p>Only the super admin can open the audit log.</p>
      </div>
    );
  }

  const first = data.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, data.total);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Audit trail</p>
          <h1 className={styles.title}>Audit log</h1>
          <p className={styles.subtitle}>Who changed what, and when.</p>
        </div>

        <div className={styles.downloads}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => download("xlsx")}
            disabled={Boolean(downloading)}
          >
            {downloading === "xlsx" ? "Preparing…" : "Download Excel report"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => download("pdf")}
            disabled={Boolean(downloading)}
          >
            {downloading === "pdf" ? "Preparing…" : "Download PDF report"}
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <label>
          <span>From</span>
          <input type="date" value={from} max={to || undefined} onChange={changeFilter(setFrom)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} min={from || undefined} onChange={changeFilter(setTo)} />
        </label>
        <label>
          <span>Module</span>
          <select value={entity} onChange={changeFilter(setEntity)}>
            <option value="">All modules</option>
            {options.entities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Action</span>
          <select value={action} onChange={changeFilter(setAction)}>
            <option value="">All actions</option>
            {options.actions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            type="search"
            placeholder="User, email or record name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.errorClose} onClick={() => setError("")} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <p className={styles.count}>
        {loading ? "Loading…" : data.total ? `Showing ${first}–${last} of ${data.total} entries` : "No entries found"}
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date &amp; time</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Record</th>
              <th>What changed</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row._id}>
                <td className={styles.nowrap}>{formatTime(row.createdAt)}</td>
                <td>
                  {row.actor?.system ? (
                    <strong>system</strong>
                  ) : (
                    <>
                      <strong>{row.actor?.name || "unknown"}</strong>
                      <div className={styles.muted}>{row.actor?.email}</div>
                      {row.actor?.role && <div className={styles.role}>{row.actor.role}</div>}
                    </>
                  )}
                </td>
                <td>
                  <span className={`${styles.badge} ${styles[ACTION_CLASS[row.action]] || ""}`}>
                    {String(row.action).toUpperCase()}
                  </span>
                </td>
                <td>{row.entity}</td>
                <td>{row.label || <span className={styles.muted}>—</span>}</td>
                <td>
                  <Changes row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pager}>
        <button type="button" className={styles.secondaryButton} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {data.pages || 1}
        </span>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={page >= (data.pages || 1) || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
