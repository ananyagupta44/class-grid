const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// helper — strip password before sending user back
function sanitize(user) {
  const obj = user.toObject ? user.toObject() : user;
  const { password, ...safe } = obj;
  return safe;
}

async function register(req, res) {
  try {
    const { name, email, identifier, password, role } = req.body;

    if (!name || !email || !identifier || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ $or: [{ email }, { identifier }] });

    if (existing) {
      return res.status(409).json({ message: "Email or identifier already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      identifier,
      password: hashedPassword,
      role: role || "student",
    });

    const token = generateToken(user);

    return res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Something went wrong during registration" });
  }
}

async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required" });
    }

    // allow login via email OR identifier (roll no. / staff ID)
    const user = await User.findOne({ $or: [{ email: identifier }, { identifier }] });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    return res.status(200).json({ token, user: sanitize(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong during login" });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user: sanitize(user) });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

module.exports = { register, login, me };