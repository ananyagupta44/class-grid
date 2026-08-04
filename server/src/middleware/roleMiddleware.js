// usage: router.get("/admin-only", protect, restrictTo("ADMIN"), handler)
function restrictTo(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do this" });
    }
    next();
  };
}

module.exports = restrictTo;
