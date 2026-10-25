import mongoose from "mongoose";
import auditPlugin from "./auditPlugin.js";

// Applies the audit plugin to EVERY model compiled after this line.
// So this file must be the FIRST import in server.js / app.js (before any model is imported).
mongoose.plugin(auditPlugin);

// Call once after the database connects. Returns (and prints) models that are NOT audited,
// which happens if a model was imported before this file.
export function auditSelfCheck(m = mongoose) {
  const missing = m
    .modelNames()
    .filter((n) => n !== "AuditLog")
    .filter((n) => !m.model(n).schema.plugins.some((p) => p.fn === auditPlugin));

  if (missing.length) {
    console.warn(`AUDIT: these models are NOT audited (import audit.setup.js before any model): ${missing.join(", ")}`);
  } else {
    console.log("AUDIT: all models are audited");
  }

  return missing;
}
