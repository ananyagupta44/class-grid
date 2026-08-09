"use client";

import Link from "next/link";
import { useLoginSidebar } from "../context/LoginSidebarContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { openLogin } = useLoginSidebar();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={`${styles.logo} font-display`}>
          ClassGrid
        </Link>

        <nav className={styles.nav}>
          <Link href="/register" className={styles.link}>
            Student Register
          </Link>
          <button className={styles.link} onClick={() => openLogin("student")}>
            Student Login
          </button>
          <button className={styles.cta} onClick={() => openLogin("admin")}>
            Admin / Staff Login
          </button>
        </nav>
      </div>
    </header>
  );
}