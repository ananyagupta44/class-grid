"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthProvider, useAuth } from "../context/AuthContext";
import {
  LoginSidebarProvider,
  useLoginSidebar,
} from "../context/LoginSidebarContext";
import Navbar from "./Navbar";
import LoginSidebar from "./LoginSidebar";
import styles from "./AppShell.module.css";

function matches(pathname, base) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/*
 * Route rules
 *   /home       → admin only
 *   /dashboard  → any logged-in user
 *   everything else is public
 */
function RouteGuard({ children }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, role, ready } = useAuth();
  const { openLogin } = useLoginSidebar();

  const adminOnly = matches(pathname, "/home");
  const needsLogin = adminOnly || matches(pathname, "/dashboard");

  const allowed =
    !needsLogin || (ready && Boolean(user) && (!adminOnly || role === "admin"));

  useEffect(() => {
    if (!needsLogin || !ready) return;

    if (!user) {
      router.replace("/");
      openLogin(adminOnly ? "admin" : "student");
      return;
    }

    if (adminOnly && role !== "admin") {
      router.replace("/dashboard");
    }
    // openLogin is recreated every render; intentionally not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLogin, adminOnly, ready, user, role, router]);

  return allowed ? children : null;
}

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <LoginSidebarProvider>
        <Navbar />
        <main className={styles.main}>
          <RouteGuard>{children}</RouteGuard>
        </main>
        <LoginSidebar />
      </LoginSidebarProvider>
    </AuthProvider>
  );
}
