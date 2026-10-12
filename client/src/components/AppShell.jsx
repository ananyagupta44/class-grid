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
 *   /home/accounts  → super admin only
 *   /home           → dept. in-charge and above
 *   /dashboard      → any logged-in user
 *   everything else is public
 */
function RouteGuard({ children }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, ready, canAccessHome, canManageAccounts } = useAuth();
  const { openLogin } = useLoginSidebar();

  const accountsPage = matches(pathname, "/home/accounts");
  const homePage = matches(pathname, "/home");
  const needsLogin = homePage || matches(pathname, "/dashboard");

  const permitted = accountsPage
    ? canManageAccounts
    : homePage
      ? canAccessHome
      : true;

  const allowed = !needsLogin || (ready && Boolean(user) && permitted);

  useEffect(() => {
    if (!needsLogin || !ready) return;

    if (!user) {
      router.replace("/");
      openLogin(homePage ? "admin" : "student");
      return;
    }

    if (!permitted) {
      // not allowed here → the closest page they ARE allowed to open
      router.replace(accountsPage && canAccessHome ? "/home" : "/dashboard");
    }
    // openLogin is recreated every render; intentionally not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLogin, homePage, accountsPage, ready, user, permitted, router]);

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
