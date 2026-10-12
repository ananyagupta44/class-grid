import jwt from "jsonwebtoken";

import User from "../models/User.js";

/*
 * Checks the login token, then reads the user's CURRENT role from the
 * database. That way a promotion / demotion / deleted account takes effect on
 * the very next request instead of when the old token expires.
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Not authorized, no token provided" });
  }

  const token = authHeader.split(" ")[1];

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res
      .status(401)
      .json({ message: "Not authorized, token invalid or expired" });
  }

  try {
    const user = await User.findById(decoded.id).select("role identifier");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Not authorized, account no longer exists" });
    }

    req.user = {
      id: String(user._id),
      role: user.role,
      identifier: user.identifier,
    };

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);

    return res.status(500).json({ message: "Could not verify your account" });
  }
};

export default protect;
