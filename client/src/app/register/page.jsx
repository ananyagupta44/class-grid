"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import { useLoginSidebar } from "../../context/LoginSidebarContext";

import styles from "./register.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];

function passwordScore(value) {
  if (!value) return 0;
  if (value.length < 8) return 0;

  let score = 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;

  return score; // 1..4
}

function validate(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = "Please enter your full name.";

  if (!values.email.trim()) errors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(values.email.trim()))
    errors.email = "That doesn't look like a valid email address.";

  if (!values.identifier.trim())
    errors.identifier = "Please enter your roll number.";

  if (!values.password) errors.password = "Please choose a password.";
  else if (values.password.length < 8)
    errors.password = "Use at least 8 characters.";

  if (!values.confirm) errors.confirm = "Please re-enter your password.";
  else if (values.confirm !== values.password)
    errors.confirm = "Passwords do not match.";

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();

  const { user, ready, login } = useAuth();
  const { openLogin } = useLoginSidebar();

  const [values, setValues] = useState({
    name: "",
    email: "",
    identifier: "",
    password: "",
    confirm: "",
  });

  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const errors = useMemo(() => validate(values), [values]);
  const score = passwordScore(values.password);

  // already signed in → nothing to register
  useEffect(() => {
    if (ready && user) {
      router.replace(user.role === "admin" ? "/home" : "/dashboard");
    }
  }, [ready, user, router]);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function markTouched(name) {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  // show an error only after the field was visited (or after a submit attempt)
  function fieldError(name) {
    return touched[name] ? errors[name] : "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setTouched({
      name: true,
      email: true,
      identifier: true,
      password: true,
      confirm: true,
    });

    if (Object.keys(errors).length > 0) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          identifier: values.identifier.trim(),
          password: values.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Registration failed");
      }

      if (!data?.token) {
        throw new Error("Account created, but no login token was returned.");
      }

      // signed in straight away
      login(data.token, data.user);

      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // avoid flashing the form to someone who is already logged in
  if (!ready || user) {
    return <div className={styles.page} aria-busy="true" />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ============ WELCOME PANEL ============ */}
        <aside className={styles.aside}>
          <p className={`font-mono-time ${styles.brand}`}>ClassGrid</p>

          <h1 className={`font-display ${styles.asideTitle}`}>
            Your timetable, always at hand.
          </h1>

          <p className={styles.asideText}>
            Create a student account to see your class schedule any time.
          </p>

          <ul className={styles.perks}>
            <li>View your course&apos;s weekly timetable</li>
            <li>Check which venue a class is in</li>
            <li>Save or print it as a PDF</li>
          </ul>

          <p className={styles.asideNote}>
            Faculty and admin accounts are created by an administrator.
          </p>
        </aside>

        {/* ============ FORM ============ */}
        <section className={styles.formSide}>
          <h2 className={`font-display ${styles.title}`}>
            Create student account
          </h2>

          <p className={styles.sub}>It only takes a minute.</p>

          {error && (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Full name</span>

                <input
                  type="text"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  onBlur={() => markTouched("name")}
                  autoComplete="name"
                  autoFocus
                  disabled={loading}
                  aria-invalid={Boolean(fieldError("name"))}
                  aria-describedby="err-name"
                />

                <small id="err-name" className={styles.fieldError}>
                  {fieldError("name")}
                </small>
              </label>

              <label className={styles.field}>
                <span>Roll number</span>

                <input
                  type="text"
                  value={values.identifier}
                  onChange={(e) => setField("identifier", e.target.value)}
                  onBlur={() => markTouched("identifier")}
                  autoComplete="username"
                  disabled={loading}
                  aria-invalid={Boolean(fieldError("identifier"))}
                  aria-describedby="err-identifier"
                />

                <small id="err-identifier" className={styles.fieldError}>
                  {fieldError("identifier")}
                </small>
              </label>
            </div>

            <label className={styles.field}>
              <span>Email</span>

              <input
                type="email"
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                onBlur={() => markTouched("email")}
                autoComplete="email"
                disabled={loading}
                aria-invalid={Boolean(fieldError("email"))}
                aria-describedby="err-email"
              />

              <small id="err-email" className={styles.fieldError}>
                {fieldError("email")}
              </small>
            </label>

            <div className={styles.field}>
              <label htmlFor="reg-password">Password</label>

              <div className={styles.passwordWrap}>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={values.password}
                  onChange={(e) => setField("password", e.target.value)}
                  onBlur={() => markTouched("password")}
                  autoComplete="new-password"
                  disabled={loading}
                  aria-invalid={Boolean(fieldError("password"))}
                  aria-describedby="err-password"
                />

                <button
                  type="button"
                  className={styles.toggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {values.password && (
                <div className={styles.strength} aria-live="polite">
                  <div className={styles.bars} aria-hidden="true">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={`${styles.bar} ${
                          score >= level ? styles[`level${score}`] : ""
                        }`}
                      />
                    ))}
                  </div>

                  <span>{STRENGTH[score]}</span>
                </div>
              )}

              <small id="err-password" className={styles.fieldError}>
                {fieldError("password")}
              </small>
            </div>

            <label className={styles.field}>
              <span>Confirm password</span>

              <input
                type={showPassword ? "text" : "password"}
                value={values.confirm}
                onChange={(e) => setField("confirm", e.target.value)}
                onBlur={() => markTouched("confirm")}
                autoComplete="new-password"
                disabled={loading}
                aria-invalid={Boolean(fieldError("confirm"))}
                aria-describedby="err-confirm"
              />

              <small id="err-confirm" className={styles.fieldError}>
                {fieldError("confirm")}
              </small>
            </label>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className={styles.foot}>
            Already have an account?{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => openLogin("student")}
            >
              Log in
            </button>
            <span className={styles.dot}>·</span>
            <Link href="/">Back to home</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
