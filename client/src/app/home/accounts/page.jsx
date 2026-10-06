"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./accounts.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data?.message || "Request failed");

  return data;
}

// readable random password (no 0/O, 1/l/I)
function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

const EMPTY = { name: "", email: "", identifier: "", password: "" };

export default function AccountsPage() {
  const [role, setRole] = useState("staff");
  const [values, setValues] = useState(EMPTY);
  const [faculties, setFaculties] = useState([]);
  const [facultyKey, setFacultyKey] = useState("");

  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  // faculty list → used to pre-fill the form
  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest("/faculty");

        const list =
          data.faculties ||
          data.faculty ||
          data.data ||
          (Array.isArray(data) ? data : []);

        setFaculties(list);
      } catch {
        // the form still works without the list
      }
    }

    load();
  }, []);

  const facultyOptions = useMemo(
    () =>
      faculties.map((item) => ({
        key: item._id || item.id,
        item,
      })),
    [faculties],
  );

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  // choosing a faculty record fills name / staff ID / email, so the staff ID
  // matches the faculty's facultyId (that match is what links the account
  // to its timetable)
  function handlePickFaculty(key) {
    setFacultyKey(key);

    const picked = facultyOptions.find((option) => option.key === key)?.item;

    if (!picked) return;

    setValues((prev) => ({
      ...prev,
      name: picked.name || prev.name,
      identifier: picked.facultyId || prev.identifier,
      email: picked.email || prev.email,
    }));
    setErrors({});
  }

  function validate() {
    const next = {};

    if (!values.name.trim()) next.name = "Enter the full name.";

    if (!values.email.trim()) next.email = "Enter an email.";
    else if (!EMAIL_RE.test(values.email.trim()))
      next.email = "That doesn't look like a valid email.";

    if (!values.identifier.trim()) next.identifier = "Enter the staff ID.";

    if (!values.password) next.password = "Set a temporary password.";
    else if (values.password.length < 8)
      next.password = "Use at least 8 characters.";

    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const next = validate();
    setErrors(next);

    if (Object.keys(next).length) return;

    setError("");
    setLoading(true);

    try {
      await apiRequest("/auth/users", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          identifier: values.identifier.trim(),
          password: values.password,
          role,
        }),
      });

      setCreated({
        name: values.name.trim(),
        identifier: values.identifier.trim(),
        password: values.password,
        role,
      });

      setValues(EMPTY);
      setFacultyKey("");
    } catch (err) {
      setError(err.message || "Could not create the account.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCredentials() {
    if (!created) return;

    const text = `ClassGrid login\nStaff ID: ${created.identifier}\nPassword: ${created.password}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the credentials are still on screen
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Admin</p>
        <h1 className={`font-display ${styles.title}`}>Create account</h1>
        <p className={styles.sub}>
          Faculty and admins can&apos;t sign themselves up. Create their login
          here, then give them the staff ID and temporary password.
        </p>
      </header>

      {/* ===== SUCCESS ===== */}
      {created && (
        <section className={styles.success} role="status">
          <h2>Account created for {created.name}</h2>

          <dl>
            <div>
              <dt>Staff ID</dt>
              <dd>{created.identifier}</dd>
            </div>

            <div>
              <dt>Temporary password</dt>
              <dd>{created.password}</dd>
            </div>
          </dl>

          <p>
            Save this now — the password can&apos;t be shown again. They log in
            with <strong>Admin / Staff Login</strong>.
          </p>

          <div className={styles.successActions}>
            <button type="button" onClick={copyCredentials}>
              {copied ? "Copied ✓" : "Copy credentials"}
            </button>

            <button type="button" onClick={() => setCreated(null)}>
              Create another
            </button>
          </div>
        </section>
      )}

      {/* ===== FORM ===== */}
      {!created && (
        <form className={styles.card} onSubmit={handleSubmit} noValidate>
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

          <div
            className={styles.roles}
            role="radiogroup"
            aria-label="Account type"
          >
            {[
              ["staff", "Faculty"],
              ["admin", "Admin"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                className={`${styles.role} ${role === value ? styles.roleOn : ""}`}
                onClick={() => setRole(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {role === "staff" && facultyOptions.length > 0 && (
            <label className={styles.field}>
              <span>Link to faculty record</span>

              <select
                value={facultyKey}
                onChange={(e) => handlePickFaculty(e.target.value)}
              >
                <option value="">Choose faculty (fills the form)</option>

                {facultyOptions.map(({ key, item }) => (
                  <option key={key} value={key}>
                    {item.facultyId} — {item.name}
                  </option>
                ))}
              </select>

              <small className={styles.hint}>
                The staff ID must equal the faculty ID — that is how the account
                finds its own timetable.
              </small>
            </label>
          )}

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Full name</span>
              <input
                type="text"
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
                disabled={loading}
              />
              <small className={styles.fieldError}>{errors.name}</small>
            </label>

            <label className={styles.field}>
              <span>Staff ID</span>
              <input
                type="text"
                value={values.identifier}
                onChange={(e) => setField("identifier", e.target.value)}
                aria-invalid={Boolean(errors.identifier)}
                disabled={loading}
              />
              <small className={styles.fieldError}>{errors.identifier}</small>
            </label>
          </div>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              disabled={loading}
            />
            <small className={styles.fieldError}>{errors.email}</small>
          </label>

          <div className={styles.field}>
            <label htmlFor="acc-password">Temporary password</label>

            <div className={styles.passwordRow}>
              <input
                id="acc-password"
                type="text"
                value={values.password}
                onChange={(e) => setField("password", e.target.value)}
                aria-invalid={Boolean(errors.password)}
                autoComplete="off"
                disabled={loading}
              />

              <button
                type="button"
                className={styles.generate}
                onClick={() => setField("password", generatePassword())}
                disabled={loading}
              >
                Generate
              </button>
            </div>

            <small className={styles.fieldError}>{errors.password}</small>
          </div>

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading
              ? "Creating..."
              : role === "admin"
                ? "Create admin account"
                : "Create faculty account"}
          </button>
        </form>
      )}
    </div>
  );
}
