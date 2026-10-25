import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Writes every audit entry as ONE line in a daily log file:
 *   <AUDIT_LOG_DIR or ./logs>/audit-2026-10-06.log
 *
 * [2026-10-06 14:32:10] UPDATE | Faculty "Dr A Sharma" (id 65a1...) | by Admin A <a@x.com> [admin] | ip=10.0.0.5 PATCH /api/faculty/65a1... | changes: noOfClassesPerWeek: 10 -> 12
 *
 * Settings (optional, in .env):
 *   AUDIT_LOG_DIR   folder for the files            (default: <project>/logs)
 *   AUDIT_TIMEZONE  time zone used in the files     (default: Asia/Kolkata)
 */

const dir = () => process.env.AUDIT_LOG_DIR || path.join(process.cwd(), "logs");

const formatters = new Map();
export function stamp(date) {
  const timeZone = process.env.AUDIT_TIMEZONE || "Asia/Kolkata";

  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    );
  }

  return formatters.get(timeZone).format(date); // "2026-10-06 14:32:10"
}

// one line only: no line breaks / tabs, and never too long
export const clean = (v, max = 80) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();

  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export const show = (v) =>
  v === null || v === undefined
    ? "null"
    : v === "[redacted]"
      ? "[redacted]"
      : typeof v === "string"
        ? JSON.stringify(clean(v))
        : clean(JSON.stringify(v));

export function formatLine(entry, at = new Date()) {
  const a = entry.actor || {};

  const who = a.system
    ? "system"
    : !a.name && !a.email && !a.id
      ? "anonymous (not logged in)"
      : `${clean(a.name || "unknown", 60)} <${clean(a.email || "no email", 80)}> [${clean(a.role || "no role", 30)}]`;

  const what = `${clean(entry.entity, 40)}${entry.label ? ` "${clean(entry.label, 60)}"` : ""}${entry.entityId ? ` (id ${clean(entry.entityId, 40)})` : ""}`;

  const parts = [`[${stamp(at)}] ${String(entry.action).toUpperCase()}`, what, `by ${who}`];

  const r = entry.request || {};
  if (r.ip || r.path) parts.push(clean(`ip=${r.ip || "-"} ${r.method || ""} ${r.path || ""}`, 140));

  if (entry.changes?.length) {
    parts.push(
      "changes: " +
        entry.changes.map((c) => `${clean(c.field, 40)}: ${show(c.from)} -> ${show(c.to)}`).join("; "),
    );
  } else if (entry.meta !== undefined) {
    parts.push("details: " + clean(typeof entry.meta === "string" ? entry.meta : JSON.stringify(entry.meta), 300));
  }

  return parts.join(" | ");
}

const WRITE_TIMEOUT_MS = 2000; // a stuck disk / network drive must never freeze a request

// Never throws: if the disk is full, read-only or stuck, the database log still has the entry.
export async function writeAuditLine(entry, at = new Date()) {
  let timer;

  try {
    const write = (async () => {
      await fs.mkdir(dir(), { recursive: true });
      await fs.appendFile(path.join(dir(), `audit-${stamp(at).slice(0, 10)}.log`), `${formatLine(entry, at)}\n`, "utf8");
    })();

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("writing the log file took too long, skipped")), WRITE_TIMEOUT_MS);
    });

    await Promise.race([write, timeout]);
  } catch (err) {
    console.error("AUDIT FILE ERROR (the change is still recorded in the database):", err.message);
  } finally {
    clearTimeout(timer);
  }
}
