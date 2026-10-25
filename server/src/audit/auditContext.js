import { AsyncLocalStorage } from "node:async_hooks";

// Carries "the current request" through async code, so the audit log can know
// WHO made a change without every controller passing the user around.
const storage = new AsyncLocalStorage();

// app.use(auditContext)  -> AFTER express.json(), BEFORE the routes.
export const auditContext = (req, res, next) => storage.run({ req }, next);

// For scripts / seeders / cron jobs: runAs({ user: {...} }, async () => { ... })
export const runAs = (fakeReq, fn) => storage.run({ req: fakeReq }, fn);

// Reads req.user lazily, so it works even though auth runs after this middleware.
export function currentActor() {
  const req = storage.getStore()?.req;

  if (!req) return { system: true, name: "system" };

  const u = req.user;

  return {
    id: u?._id || u?.id,
    name: u?.name,
    email: u?.email,
    role: u?.role,
    ip: req.ip,
    method: req.method,
    path: (req.originalUrl || req.url || "").split("?")[0],
  };
}
