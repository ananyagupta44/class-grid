"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { can, normalizeRole } from "./permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const STORAGE_KEYS = ["token", "user", "userId", "role"];

const AuthContext = createContext(null);

function clearStorage() {
  STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function storeSession(token, user) {
  localStorage.setItem("token", token);

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
    if (user._id) localStorage.setItem("userId", user._id);
    if (user.role) localStorage.setItem("role", user.role);
  }
}

function readStoredUser() {
  try {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");

    if (!token || !raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // false until localStorage has been read (avoids a logged-out flash)
  const [ready, setReady] = useState(false);

  // ---- restore session, then confirm it with the server ----
  useEffect(() => {
    setUser(readStoredUser());
    setReady(true);

    const token = localStorage.getItem("token");
    if (!token) return undefined;

    let cancelled = false;

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (cancelled) return;

        // token expired / user deleted → log out
        if (response.status === 401 || response.status === 404) {
          clearStorage();
          setUser(null);
          return;
        }

        if (!response.ok) return;

        const data = await response.json().catch(() => null);

        if (data?.user) {
          storeSession(token, data.user);
          setUser(data.user);
        }
      })
      .catch(() => {
        // offline / server down: keep the stored session
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- keep several tabs in sync ----
  useEffect(() => {
    function onStorage(event) {
      if (event.key === null || event.key === "token" || event.key === "user") {
        setUser(readStoredUser());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((token, nextUser) => {
    storeSession(token, nextUser);
    setUser(nextUser || null);
  }, []);

  const logout = useCallback(() => {
    clearStorage();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = normalizeRole(user?.role);

    const allow = (permission) => can(role, permission);

    return {
      user,
      role,
      ready,
      isLoggedIn: Boolean(user),

      can: allow,

      isStudent: role === "student",

      // ---- viewing ----
      canViewOwnFaculty: allow("viewOwnFacultyTT"),
      canViewAllFaculty: allow("viewAllFacultyTT"),

      // ---- department setup (dept. in-charge and above) ----
      canAccessHome: allow("accessHome"),
      canAddCourse: allow("addCourse"),
      canAddFaculty: allow("addFaculty"),
      canAddSubjectToCourse: allow("addSubjectToCourse"),
      canAssignFaculty: allow("assignFaculty"),

      // ---- timetable work (admin / TT team and above) ----
      canEditTimetable: allow("editTimetable"),
      canGenerate: allow("generateTimetable"),
      canManageCombos: allow("manageCombos"),

      // ---- super admin only ----
      canAddSubject: allow("addSubject"),
      canAddRoom: allow("addRoom"),
      canAddSession: allow("addSession"),
      canManageAccounts: allow("manageAccounts"),
      canViewAuditLog: allow("viewAuditLog"),

      login,
      logout,
    };
  }, [user, ready, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return ctx;
}
