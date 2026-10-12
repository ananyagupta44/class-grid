import { can, normalizeRole } from "../utils/permissions.js";

/*
 * Preferred: ask for a PERMISSION (see utils/permissions.js)
 *   router.post("/", protect, requirePermission("addCourse"), createCourse);
 *
 * Still available: ask for specific ROLES
 *   router.get("/x", protect, restrictTo("admin", "super_admin"), handler);
 */

const deny = (res) =>
  res.status(403).json({ message: "You do not have permission to do this" });

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user || !can(req.user.role, permission)) return deny(res);

  next();
};

const restrictTo =
  (...allowedRoles) =>
  (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    if (!role || !allowedRoles.map(normalizeRole).includes(role)) {
      return deny(res);
    }

    next();
  };

export default restrictTo;
