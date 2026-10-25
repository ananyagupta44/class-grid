import AuditLog from "../models/AuditLog.js";
import { can } from "../utils/permissions.js"; // adjust the path to wherever your permissions.js lives
import { logAudit, actorProfile } from "../audit/audit.service.js";
import { writeXlsx, writePdf } from "../audit/auditReport.js";

const MAX_REPORT_ROWS = 10000;
const TITLE = process.env.AUDIT_REPORT_TITLE || "ClassGrid - Audit Log Report";
const IST = "+05:30"; // a date typed as 2026-10-01 means that whole day in Indian time

const allowed = (req) => can(req.user?.role, "viewAuditLog");
const str = (v, max = 100) => (typeof v === "string" && v.length <= max ? v : undefined);
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// undefined = not valid, null = not given
function parseDate(v, endOfDay) {
  if (!v) return null;
  if (typeof v !== "string") return undefined;

  const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${IST}`)
    : new Date(v);

  return isNaN(d) ? undefined : d;
}

// the same filters drive the on-screen list and the downloaded reports
function buildFilter(q) {
  const filter = {};

  if (str(q.entity)) filter.entity = q.entity;
  if (str(q.entityId)) filter.entityId = q.entityId;
  if (str(q.actor)) filter["actor.id"] = q.actor;
  if (str(q.action)) filter.action = q.action;

  const from = parseDate(q.from, false);
  const to = parseDate(q.to, true);

  if (from === undefined || to === undefined) return { error: "from / to must be valid dates (YYYY-MM-DD)" };
  if (from && to && from > to) return { error: "'from' date is after the 'to' date" };

  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const text = str(q.q, 60)?.trim();
  if (text) {
    const rx = new RegExp(escapeRx(text), "i");
    filter.$or = [{ "actor.name": rx }, { "actor.email": rx }, { label: rx }, { summary: rx }];
  }

  return { filter, from, to };
}

const describeFilters = (q) =>
  [
    str(q.entity) && `Module = ${q.entity}`,
    str(q.action) && `Action = ${q.action.toUpperCase()}`,
    str(q.actor) && `User id = ${q.actor}`,
    str(q.q, 60)?.trim() && `Search = "${q.q.trim()}"`,
  ]
    .filter(Boolean)
    .join(",  ");

const deny = (res) => res.status(403).json({ message: "You do not have access to the audit log" });

// GET /api/audit?entity=&action=&actor=&q=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=25
export const list = async (req, res) => {
  try {
    if (!allowed(req)) return deny(res);

    const { filter, error } = buildFilter(req.query);
    if (error) return res.status(400).json({ message: error });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/audit/filters  -> values for the filter drop-downs
export const filters = async (req, res) => {
  try {
    if (!allowed(req)) return deny(res);

    const [entities, actions] = await Promise.all([AuditLog.distinct("entity"), AuditLog.distinct("action")]);

    return res.json({ entities: entities.sort(), actions: actions.sort() });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/audit/export?format=xlsx|pdf  + the same filters as the list
// no dates given -> the last 30 days; at most 10,000 entries (newest first)
export const exportReport = async (req, res) => {
  try {
    if (!allowed(req)) return deny(res);

    const format = req.query.format;
    if (!["xlsx", "pdf"].includes(format)) {
      return res.status(400).json({ message: "format must be xlsx or pdf" });
    }

    let { filter, from, to, error } = buildFilter(req.query);
    if (error) return res.status(400).json({ message: error });

    if (!from && !to) {
      from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: from };
    }

    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS + 1)
      .lean();

    const capped = rows.length > MAX_REPORT_ROWS;
    if (capped) rows.pop();

    const generatedBy = await actorProfile();
    const meta = {
      title: TITLE,
      generatedAt: new Date(),
      generatedBy: { name: generatedBy.name, email: generatedBy.email },
      from,
      to,
      filters: describeFilters(req.query),
      total: rows.length,
      capped,
    };

    // downloading the log is itself recorded in the log
    await logAudit({
      action: "export",
      entity: "AuditReport",
      summary: `${generatedBy.name || "someone"} downloaded the audit report (${format.toUpperCase()}, ${rows.length} entries)`,
      meta: { format, entries: rows.length, filters: meta.filters || "none" },
    });

    const day = (d) => (d ? new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "start");
    const name = `audit-report_${day(from)}_to_${to ? day(to) : "today"}.${format}`;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);

    if (format === "xlsx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeXlsx(rows, meta, res);
    } else {
      res.setHeader("Content-Type", "application/pdf");
      writePdf(rows, meta, res);
    }
  } catch (err) {
    console.error("AUDIT EXPORT ERROR:", err);

    if (res.headersSent) return res.destroy();

    return res.status(500).json({ message: err.message });
  }
};
