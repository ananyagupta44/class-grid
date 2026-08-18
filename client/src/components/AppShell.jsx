"use client";

import { LoginSidebarProvider } from "../context/LoginSidebarContext";
import Navbar from "./Navbar";
import LoginSidebar from "./LoginSidebar";
import styles from "./AppShell.module.css";

export default function AppShell({ children }) {
  return (
    <LoginSidebarProvider>
      <Navbar />
      <main className={styles.main}>{children}</main>
      <LoginSidebar />
    </LoginSidebarProvider>
  );
}
