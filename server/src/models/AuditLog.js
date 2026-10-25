import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // who
    actor: {
      id: String,
      name: String,
      email: String,
      role: String,
      system: Boolean, // true when the change came from a script, not a logged-in user
    },

    // what
    action: { type: String, required: true }, // create | update | delete | bulk-update | bulk-delete | generate | ...
    entity: { type: String, required: true }, // model name, e.g. Faculty, Room, ExtraClassBooking
    entityId: String,
    label: String, // human name of the record, e.g. "Jitendra Goyal"
    summary: String, // one readable line

    // details
    changes: [{ _id: false, field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
    snapshot: mongoose.Schema.Types.Mixed, // full record for create / delete (passwords removed)
    meta: mongoose.Schema.Types.Mixed,

    // from where
    request: { ip: String, method: String, path: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ "actor.id": 1, createdAt: -1 });

// Append-only: the app can never edit or delete a log entry.
const blocked = () => {
  throw new Error("Audit logs are append-only");
};

for (const op of [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
]) {
  auditLogSchema.pre(op, { query: true, document: false }, blocked);
}

auditLogSchema.pre("deleteOne", { document: true, query: false }, blocked);

auditLogSchema.pre("save", function () {
  if (!this.isNew) blocked();
});

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
