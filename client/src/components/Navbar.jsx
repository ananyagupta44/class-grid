"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useLoginSidebar } from "../context/LoginSidebarContext";
import ProfileMenu from "./ProfileMenu";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { openLogin } = useLoginSidebar();
  const { user, ready, isAdmin } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/" className={`${styles.logo} font-display`}>
            ClassGrid
          </Link>

          {/* only links the signed-in user is allowed to open */}
          {ready && user && (
            <nav className={styles.mainNav}>
              {isAdmin && (
                <Link href="/home" className={styles.link}>
                  Home
                </Link>
              )}

              <Link href="/dashboard" className={styles.link}>
                Dashboard
              </Link>

              {isAdmin && (
                <Link href="/home/accounts" className={styles.link}>
                  Accounts
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* nothing on the right until we know whether someone is signed in */}
        {ready && user && <ProfileMenu />}

        {ready && !user && (
          <nav className={styles.nav}>
            <Link href="/register" className={styles.link}>
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
