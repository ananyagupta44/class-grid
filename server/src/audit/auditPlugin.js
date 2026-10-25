import AuditLog from "../models/AuditLog.js";
import { logAudit, diffDocs, labelOf, asText } from "./audit.service.js";

// never audit the log itself
const SKIP_MODELS = new Set(["AuditLog"]);
// bulk delete / update of these is logged by the controller instead (timetable generation)
const SKIP_BULK = new Set(["TimetableEntry"]);

// a record can only be deleted once, so if a delete entry exists for it, it is already logged
// (doc.deleteOne() triggers both the document and the query hooks in some Mongoose versions)
async function logDelete({ entity, id, label, snapshot }) {
  if (await AuditLog.exists({ entity, entityId: String(id), action: "delete" }))
    return;

  await logAudit({ action: "delete", entity, entityId: id, label, snapshot });
}

const Q = { query: true, document: false };
const D = { document: true, query: false };

/**
 * Records create / update / delete of single records, with before -> after values.
 *   logged  : save(), create(), findOneAndUpdate / findByIdAndUpdate, updateOne,
 *             findOneAndDelete / findByIdAndDelete, deleteOne, doc.deleteOne(),
 *             and ONE summary entry for updateMany / deleteMany
 *   not logged one-by-one: insertMany (e.g. timetable generation)
 */
export default function auditPlugin(schema) {
  // ---------- create + update through doc.save() / Model.create() ----------
  schema.pre("save", async function () {
    // embedded entries (e.g. Course.subjects[]) are not models: the parent
    // Course is audited as a whole, so skip them
    if (this.$isSubdocument || typeof this.constructor.findById !== "function")
      return;

    const entity = this.constructor.modelName;
    if (SKIP_MODELS.has(entity)) return;

    this.$locals.auditIsNew = this.isNew;

    if (!this.isNew) {
      this.$locals.auditBefore = await this.constructor
        .findById(this._id)
        .lean();
    }
  });

  schema.post("save", async function (doc) {
    if (doc.$isSubdocument || typeof doc.constructor.findById !== "function")
      return;

    const entity = doc.constructor.modelName;
    if (SKIP_MODELS.has(entity)) return;

    if (doc.$locals.auditIsNew) {
      await logAudit({
        action: "create",
        entity,
        entityId: doc._id,
        label: labelOf(doc),
        snapshot: doc.toObject(),
      });
      return;
    }

    const changes = diffDocs(doc.$locals.auditBefore, doc.toObject());

    if (changes.length) {
      await logAudit({
        action: "update",
        entity,
        entityId: doc._id,
        label: labelOf(doc),
        changes,
      });
    }
  });

  // ---------- update through queries ----------
  for (const op of ["findOneAndUpdate", "updateOne"]) {
    schema.pre(op, Q, async function () {
      if (SKIP_MODELS.has(this.model.modelName)) return;

      this._auditBefore = await this.model.findOne(this.getFilter()).lean();
    });

    schema.post(op, Q, async function () {
      const before = this._auditBefore;
      if (!before) return;

      const after = await this.model.findById(before._id).lean();
      const changes = diffDocs(before, after);

      if (changes.length) {
        await logAudit({
          action: "update",
          entity: this.model.modelName,
          entityId: before._id,
          label: labelOf(after || before),
          changes,
        });
      }
    });
  }

  // ---------- delete through queries ----------
  for (const op of ["findOneAndDelete", "deleteOne"]) {
    schema.pre(op, Q, async function () {
      if (SKIP_MODELS.has(this.model.modelName)) return;

      this._auditBefore = await this.model.findOne(this.getFilter()).lean();
    });

    schema.post(op, Q, async function () {
      const before = this._auditBefore;
      if (!before) return;

      // only log if the record is really gone
      if (await this.model.exists({ _id: before._id })) return;

      await logDelete({
        entity: this.model.modelName,
        id: before._id,
        label: labelOf(before),
        snapshot: before,
      });
    });
  }

  // doc.deleteOne()
  schema.post("deleteOne", D, async function () {
    const entity = this.constructor.modelName;
    if (SKIP_MODELS.has(entity)) return;

    await logDelete({
      entity,
      id: this._id,
      label: labelOf(this),
      snapshot: this.toObject(),
    });
  });

  // ---------- bulk operations: one summary entry ----------
  schema.post("updateMany", Q, async function (res) {
    const entity = this.model.modelName;
    if (SKIP_MODELS.has(entity) || SKIP_BULK.has(entity)) return;

    await logAudit({
      action: "bulk-update",
      entity,
      meta: {
        filter: asText(this.getFilter()),
        update: asText(this.getUpdate()),
        modified: res?.modifiedCount,
      },
    });
  });

  schema.post("deleteMany", Q, async function (res) {
    const entity = this.model.modelName;
    if (SKIP_MODELS.has(entity) || SKIP_BULK.has(entity)) return;

    await logAudit({
      action: "bulk-delete",
      entity,
      meta: { filter: asText(this.getFilter()), deleted: res?.deletedCount },
    });
  });
}
