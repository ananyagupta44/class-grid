"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./DashboardTabs.module.css";

const LINKS = [
  { href: "/dashboard", label: "Timetable generator", exact: true },
  { href: "/dashboard/manage", label: "Manage faculty, courses & venues" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className={styles.tabRow}>
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
