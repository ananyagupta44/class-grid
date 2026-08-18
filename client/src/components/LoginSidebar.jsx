"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useLoginSidebar } from "../context/LoginSidebarContext";

import styles from "./LoginSidebar.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const roleCopy = {
  student: {
    title: "Student Login",
    sub: "Check your section's weekly schedule.",
    idLabel: "Roll number",
  },

  admin: {
    title: "Admin / Staff Login",
    sub: "Manage staff, subjects and generated timetables.",
    idLabel: "Staff ID",
  },

  staff: {
    title: "Staff Login",
    sub: "View your assigned classes and rooms.",
    idLabel: "Staff ID",
  },
};

export default function LoginSidebar() {
  const router = useRouter();

  const { isOpen, role, closeLogin } = useLoginSidebar();

  const copy = roleCopy[role] ?? roleCopy.student;

  // ================================================
  // FORM STATE
  // ================================================

  const [identifier, setIdentifier] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // ================================================
  // RESET FORM WHEN LOGIN OPENS
  // ================================================

  useEffect(() => {
    if (isOpen) {
      setIdentifier("");
      setPassword("");
      setError("");
      setLoading(false);
    }
  }, [isOpen, role]);

  // ================================================
  // CLOSE ON ESCAPE
  // ================================================

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        closeLogin();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", onKey);
    }

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeLogin]);

  // ================================================
  // LOGIN
  // ================================================

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      // ==========================================
      // BACKEND ERROR
      // ==========================================

      if (!response.ok) {
        throw new Error(data?.message || "Invalid credentials");
      }

      // ==========================================
      // CHECK TOKEN
      // ==========================================

      if (!data?.token) {
        throw new Error(
          "Login succeeded but no authentication token was returned.",
        );
      }

      // ==========================================
      // SAVE JWT
      // ==========================================

      localStorage.setItem("token", data.token);

      // ==========================================
      // SAVE USER
      // ==========================================

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));

        if (data.user._id) {
          localStorage.setItem("userId", data.user._id);
        }
      }

      // ==========================================
      // SAVE ROLE
      // ==========================================

      if (data.user?.role) {
        localStorage.setItem("role", data.user.role);
      }

      console.log("Login successful:", data.user);

      // ==========================================
      // CLOSE LOGIN DRAWER
      // ==========================================

      closeLogin();

      // ==========================================
      // REDIRECT
      // ==========================================

      /*
       * Admin → Home / management page
       *
       * Staff / Student can later be
       * redirected to their own dashboard.
       */

      if (data.user?.role === "admin") {
        router.push("/home");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);

      setError(err.message || "Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ==========================================
          OVERLAY
      =========================================== */}

      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ""}`}
        onClick={loading ? undefined : closeLogin}
        aria-hidden={!isOpen}
      />

      {/* ==========================================
          LOGIN PANEL
      =========================================== */}

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        {/* CLOSE */}

        <button
          type="button"
          className={styles.close}
          onClick={loading ? undefined : closeLogin}
          aria-label="Close login panel"
          disabled={loading}
        >
          ✕
        </button>

        {/* BRAND */}

        <p
          className="font-mono-time"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            color: "var(--marigold-dark)",
            textTransform: "uppercase",
          }}
        >
          ClassGrid
        </p>

        <h2 className={`font-display ${styles.title}`}>{copy.title}</h2>

        <p className={styles.sub}>{copy.sub}</p>

        {/* ========================================
            ERROR
        ========================================= */}

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* ========================================
            FORM
        ========================================= */}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* IDENTIFIER */}

          <label className={styles.field}>
            <span>{copy.idLabel}</span>

            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus={isOpen}
              autoComplete="username"
              disabled={loading}
            />
          </label>

          {/* PASSWORD */}

          <label className={styles.field}>
            <span>Password</span>

            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          {/* SUBMIT */}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {/* FOOTER */}

        <p className={styles.footNote}>
          New here?{" "}
          <a
            href="/register"
            onClick={loading ? (e) => e.preventDefault() : closeLogin}
          >
            Create an account
          </a>
        </p>
      </aside>
    </>
  );
}
