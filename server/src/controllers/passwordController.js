import bcrypt from "bcryptjs";

import User from "../models/User.js";

/*
 * PUT /api/auth/change-password        (protect)
 * body: { currentPassword, newPassword }
 *
 * Works for any logged-in user (faculty, admin, student...). The user is
 * taken from the login token, never from the request body, so nobody can
 * change someone else's password with this.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 72; // bcrypt ignores everything after 72 bytes

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (newPassword.length < MIN_LENGTH) {
      return res.status(400).json({
        message: `New password must be at least ${MIN_LENGTH} characters`,
      });
    }

    if (Buffer.byteLength(newPassword, "utf8") > MAX_LENGTH) {
      return res.status(400).json({
        message: `New password is too long (max ${MAX_LENGTH} characters)`,
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        message: "New password must be different from the current one",
      });
    }

    const user = await User.findById(req.user?.id || req.user?._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);

    if (!matches) {
      // 400, not 401: a 401 would make the app think the login expired
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);

    return res.status(500).json({
      message: "Something went wrong while changing the password",
    });
  }
};
