// usage: router.post("/x", protect, restrictTo("admin"), handler)
//        router.put("/y", protect, restrictTo("admin", "staff"), handler)
//
// Roles are compared case-insensitively. The old version compared exactly,
// so restrictTo("ADMIN") never matched the stored role "admin".
//
// NOTE: this relies on the JWT containing the role. Your generateToken()
// must sign { id: user._id, role: user.role }.

const restrictTo = (...allowedRoles) => {
  const allowed = allowedRoles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();

    if (!role || !allowed.includes(role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do this" });
    }

    next();
  };
};

export default restrictTo;
