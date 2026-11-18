"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useLoginSidebar } from "../context/LoginSidebarContext";
import ProfileMenu from "./ProfileMenu";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const { openLogin } = useLoginSidebar();
  const { user, ready, canAccessHome, canManageAccounts, canViewAuditLog } =
    useAuth();

  // the links this user may see
  const links = [
    canAccessHome && { href: "/home", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    canManageAccounts && { href: "/home/accounts", label: "Accounts" },
    canViewAuditLog && { href: "/audit", label: "Audit Logs" },
  ].filter(Boolean);

  // the most specific match wins, so /home/accounts does not also light up Home
  const activeHref = links
    .filter(({ href }) => pathname === href || pathname?.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/" className={`${styles.logo} font-display`}>
            ClassGrid
          </Link>

          {ready && user && (
            <nav className={styles.mainNav}>
              {links.map(({ href, label }) => {
                const active = href === activeHref;

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${styles.link} ${active ? styles.active : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {ready && user && <ProfileMenu />}

        {ready && !user && (
          <nav className={styles.nav}>
            <Link
              href="/register"
              className={`${styles.link} ${pathname === "/register" ? styles.active : ""}`}
              aria-current={pathname === "/register" ? "page" : undefined}
            >
              Student Register
            </Link>

            <button
              className={styles.link}
              onClick={() => openLogin("student")}
            >
              Student Login
            </button>

            <button className={styles.cta} onClick={() => openLogin("admin")}>
              Admin / Staff Login
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
