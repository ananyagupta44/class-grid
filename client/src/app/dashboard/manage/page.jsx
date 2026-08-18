"use client";

import { useState } from "react";
import { useTimetable } from "../../../context/TimetableContext";
import styles from "./manage.module.css";

export default function ManagePage() {
  const {
    courses,
    faculties,
    venues,
    addCourse,
    removeCourse,
    addFaculty,
    removeFaculty,
    addVenue,
    removeVenue,
  } = useTimetable();

  const [tab, setTab] = useState("course");
  const [courseForm, setCourseForm] = useState({
    code: "",
    semester: "",
    session: "Monsoon",
    subjects: [""],
  });
  const [facultyForm, setFacultyForm] = useState({
    name: "",
    dept: "",
    email: "",
  });
  const [venueForm, setVenueForm] = useState({
    name: "",
    type: "Classroom",
    capacity: "",
  });

  function submitCourse(event) {
    event.preventDefault();
    const result = addCourse(courseForm);
    if (!result.ok) return;

    setCourseForm({
      code: "",
      semester: "",
      session: "Monsoon",
      subjects: [""],
    });
  }

  function submitFaculty(event) {
    event.preventDefault();
    const result = addFaculty(facultyForm);
    if (!result.ok) return;
    setFacultyForm({ name: "", dept: "", email: "" });
  }

  function submitVenue(event) {
    event.preventDefault();
    const result = addVenue(venueForm);
    if (!result.ok) return;
    setVenueForm({ name: "", type: "Classroom", capacity: "" });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Timetable setup</p>
          <h1 className={`font-display ${styles.title}`}>
            Courses, faculty & venues
          </h1>
          <p className={styles.subtitle}>
            Create the building blocks used by the course timetable.
          </p>
        </div>
      </header>

      <div className={styles.tabRow}>
        {[
          ["course", "Courses / Sections"],
          ["faculty", "Faculty"],
          ["venue", "Venues"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`${styles.tabBtn} ${tab === id ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          {tab === "course" && (
            <form onSubmit={submitCourse}>
              <h2>+ New course</h2>
              <p>
                Example: <strong>BTECH1A</strong>. A blank timetable is created
                automatically.
              </p>

              <label>
                Course / section
                <input
                  value={courseForm.code}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="BTECH1A"
                />
              </label>

              <label>
                Semester
                <input
                  value={courseForm.semester}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, semester: e.target.value })
                  }
                  placeholder="1"
                />
              </label>

              <label>
                Session
                <select
                  value={courseForm.session}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, session: e.target.value })
                  }
                >
                  <option>Monsoon</option>
                  <option>Spring</option>
                </select>
              </label>

              <div className={styles.subjectBuilder}>
                <div className={styles.subjectHead}>
                  <strong>Subjects</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setCourseForm((prev) => ({
                        ...prev,
                        subjects: [...prev.subjects, ""],
                      }))
                    }
                  >
                    + Add subject
                  </button>
                </div>

                {courseForm.subjects.map((subject, index) => (
                  <input
                    key={index}
                    value={subject}
                    onChange={(e) =>
                      setCourseForm((prev) => ({
                        ...prev,
                        subjects: prev.subjects.map((item, i) =>
                          i === index ? e.target.value : item,
                        ),
                      }))
                    }
                    placeholder={`Subject ${index + 1} e.g. DSA`}
                  />
                ))}
              </div>

              <button className={styles.submit} type="submit">
                Create blank timetable
              </button>
            </form>
          )}

          {tab === "faculty" && (
            <form onSubmit={submitFaculty}>
              <h2>+ New faculty</h2>
              <p>Faculty can later be assigned to any subject in a course.</p>

              <label>
                Full name
                <input
                  value={facultyForm.name}
                  onChange={(e) =>
                    setFacultyForm({ ...facultyForm, name: e.target.value })
                  }
                  placeholder="Dr. Anil Mehta"
                />
              </label>

              <label>
                Department
                <input
                  value={facultyForm.dept}
                  onChange={(e) =>
                    setFacultyForm({ ...facultyForm, dept: e.target.value })
                  }
                  placeholder="Computer Science"
                />
              </label>

              <label>
                Email
                <input
                  value={facultyForm.email}
                  onChange={(e) =>
                    setFacultyForm({ ...facultyForm, email: e.target.value })
                  }
                  placeholder="name@college.edu"
                />
              </label>

              <button className={styles.submit} type="submit">
                Add faculty
              </button>
            </form>
          )}

          {tab === "venue" && (
            <form onSubmit={submitVenue}>
              <h2>+ New venue</h2>
              <p>These rooms and labs become drop targets for class blocks.</p>

              <label>
                Venue name
                <input
                  value={venueForm.name}
                  onChange={(e) =>
                    setVenueForm({ ...venueForm, name: e.target.value })
                  }
                  placeholder="Room 204"
                />
              </label>

              <label>
                Type
                <select
                  value={venueForm.type}
                  onChange={(e) =>
                    setVenueForm({ ...venueForm, type: e.target.value })
                  }
                >
                  <option>Classroom</option>
                  <option>Computer Lab</option>
                  <option>Laboratory</option>
                </select>
              </label>

              <label>
                Capacity
                <input
                  type="number"
                  min="0"
                  value={venueForm.capacity}
                  onChange={(e) =>
                    setVenueForm({ ...venueForm, capacity: e.target.value })
                  }
                  placeholder="60"
                />
              </label>

              <button className={styles.submit} type="submit">
                Add venue
              </button>
            </form>
          )}
        </section>

        <section className={styles.listCard}>
          <p className={styles.listHeading}>
            {tab === "course"
              ? `${courses.length} course sections`
              : tab === "faculty"
                ? `${faculties.length} faculty`
                : `${venues.length} venues`}
          </p>

          {tab === "course" && (
            <ul className={styles.list}>
              {courses.map((course) => (
                <li key={course.id} className={styles.row}>
                  <div>
                    <strong>{course.code}</strong>
                    <span>
                      Semester {course.semester} · {course.session} ·{" "}
                      {course.subjects.map((s) => s.name).join(", ")}
                    </span>
                  </div>
                  <button onClick={() => removeCourse(course.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          {tab === "faculty" && (
            <ul className={styles.list}>
              {faculties.map((faculty) => (
                <li key={faculty.id} className={styles.row}>
                  <div>
                    <strong>{faculty.name}</strong>
                    <span>
                      {faculty.dept} · {faculty.email}
                    </span>
                  </div>
                  <button onClick={() => removeFaculty(faculty.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          {tab === "venue" && (
            <ul className={styles.list}>
              {venues.map((venue) => (
                <li key={venue.id} className={styles.row}>
                  <div>
                    <strong>{venue.name}</strong>
                    <span>
                      {venue.type} · {venue.capacity} seats
                    </span>
                  </div>
                  <button onClick={() => removeVenue(venue.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
