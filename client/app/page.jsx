"use client";

import Link from "next/link";
import { useLoginSidebar } from "../context/LoginSidebarContext";
import styles from "./page.module.css";

const features = [
  {
    title: "Admin Panel",
    desc: "Add staff, subjects and rooms, then generate a clash-free timetable in one pass.",
    icon: "🗂️",
    role: "admin",
  },
  {
    title: "Staff Access",
    desc: "See your assigned classes and room schedule without hunting through a spreadsheet.",
    icon: "🧑‍🏫",
    role: "staff",
  },
  {
    title: "Student Portal",
    desc: "Check your section's weekly timetable from any device, any time.",
    icon: "🎓",
    role: "student",
  },
];

export default function Home() {
  const { openLogin } = useLoginSidebar();

  return (
    <div>
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <p className={`font-mono-time ${styles.eyebrow}`}>
            Automatic scheduling, zero clashes
          </p>
          <h1 className={`font-display ${styles.headline}`}>
            The timetable, generated for you
          </h1>
          <p className={styles.subhead}>
            ClassGrid builds a conflict-free weekly schedule for every section,
            teacher and room &mdash; automatically.
          </p>
          <div className={styles.heroActions}>
            <Link href="/register" className={styles.primaryBtn}>
              Student Register
            </Link>
            <button
              className={styles.secondaryBtn}
              onClick={() => openLogin("student")}
            >
              Login
            </button>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        {features.map((f) => (
          <button
            key={f.title}
            className={styles.card}
            onClick={() => openLogin(f.role)}
          >
            <span className={styles.cardIcon}>{f.icon}</span>
            <h3 className={`font-display ${styles.cardTitle}`}>{f.title}</h3>
            <p className={styles.cardDesc}>{f.desc}</p>
          </button>
        ))}
      </section>
    </div>
  );
}
