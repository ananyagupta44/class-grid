"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ==================================================
// API HELPER
// ==================================================

async function apiRequest(endpoint, options = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),

      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Something went wrong");
  }

  return data;
}

// ==================================================
// HOME PAGE
// ==================================================

export default function HomePage() {
  const router = useRouter();

  // ------------------------------------------------
  // Data
  // ------------------------------------------------

  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [venues, setVenues] = useState([]);

  // ------------------------------------------------
  // Current session
  // ------------------------------------------------

  const [selectedSession, setSelectedSession] = useState(null);

  // ------------------------------------------------
  // Loading
  // ------------------------------------------------

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // ------------------------------------------------
  // Modals
  // ------------------------------------------------

  const [showSessionModal, setShowSessionModal] = useState(false);

  const [modalType, setModalType] = useState(null);

  const [editingItem, setEditingItem] = useState(null);

  // ------------------------------------------------
  // Initial load
  // ------------------------------------------------

  useEffect(() => {
    loadData();
  }, []);

  // ==================================================
  // LOAD ALL DATA
  // ==================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        sessionsResponse,
        coursesResponse,
        subjectsResponse,
        facultyResponse,
        roomsResponse,
      ] = await Promise.all([
        apiRequest("/sessions"),
        apiRequest("/courses"),
        apiRequest("/subjects"),
        apiRequest("/faculty"),
        apiRequest("/rooms"),
      ]);

      const loadedSessions = sessionsResponse?.sessions || [];

      setSessions(loadedSessions);

      setCourses(coursesResponse?.courses || []);

      setSubjects(subjectsResponse?.subjects || []);

      setFaculty(facultyResponse?.faculty || []);

      setVenues(roomsResponse?.rooms || []);

      // ----------------------------------------------
      // Restore previously selected session
      // ----------------------------------------------

      const savedSessionId = localStorage.getItem("selectedSessionId");

      const savedSession = loadedSessions.find(
        (session) => session._id === savedSessionId,
      );

      if (savedSession) {
        setSelectedSession(savedSession);
      } else if (loadedSessions.length === 1) {
        setSelectedSession(loadedSessions[0]);
      } else {
        setShowSessionModal(true);
      }
    } catch (err) {
      console.error(err);

      setError(err.message || "Failed to load ClassGrid data");

      setShowSessionModal(true);
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // SELECT SESSION
  // ==================================================

  function selectSession(session) {
    setSelectedSession(session);

    localStorage.setItem("selectedSessionId", session._id);

    setShowSessionModal(false);
  }

  // ==================================================
  // CREATE SESSION
  // ==================================================

  async function handleCreateSession(sessionId) {
    try {
      const response = await apiRequest("/sessions", {
        method: "POST",

        body: JSON.stringify({
          sessionId,
        }),
      });

      const newSession = response.session;

      setSessions((prev) => [newSession, ...prev]);

      selectSession(newSession);
    } catch (err) {
      throw err;
    }
  }

  // ==================================================
  // OPEN MODAL
  // ==================================================

  function openCreateModal(type) {
    setEditingItem(null);
    setModalType(type);
  }

  function openEditModal(type, item) {
    setEditingItem(item);
    setModalType(type);
  }

  function closeModal() {
    setModalType(null);
    setEditingItem(null);
  }

  // ==================================================
  // FILTER COURSES BY SESSION
  // ==================================================

  const sessionCourses = useMemo(() => {
    if (!selectedSession) {
      return [];
    }

    return courses.filter((course) => {
      const courseSession = course.session;

      const sessionId =
        typeof courseSession === "object" ? courseSession?._id : courseSession;

      return sessionId === selectedSession._id;
    });
  }, [courses, selectedSession]);

  // ==================================================
  // OPEN COURSE DASHBOARD
  // ==================================================

  function openCourse(course) {
    router.push(`/dashboard?courseId=${course._id}`);
  }

  // ==================================================
  // SESSION CHANGE
  // ==================================================

  function handleSessionChange(event) {
    const session = sessions.find((item) => item._id === event.target.value);

    if (session) {
      selectSession(session);
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.loadingMark}>CG</div>

          <p>Loading ClassGrid...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* ==========================================
          HEADER
      =========================================== */}

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ClassGrid</p>

          <h1>Academic workspace</h1>

          <p className={styles.subtitle}>
            Manage your courses, subjects, faculty and venues for the selected
            academic session.
          </p>
        </div>

        {/* SESSION SELECTOR */}

        {selectedSession && (
          <div className={styles.sessionSelector}>
            <span>CURRENT SESSION</span>

            <select value={selectedSession._id} onChange={handleSessionChange}>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.sessionId}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={styles.changeSession}
              onClick={() => setShowSessionModal(true)}
            >
              Change
            </button>
          </div>
        )}
      </header>

      {/* ==========================================
          ERROR
      =========================================== */}

      {error && <div className={styles.error}>{error}</div>}

      {/* ==========================================
          FOUR COLUMNS
      =========================================== */}

      {selectedSession && (
        <section className={styles.dashboardColumns}>
          {/* ========================================
              COURSES
          ========================================= */}

          <ManagementColumn
            eyebrow="01"
            title="Courses"
            description="Create course sections and assign their subjects."
            count={sessionCourses.length}
            actionLabel="+ Add course"
            onAdd={() => openCreateModal("course")}
          >
            {sessionCourses.length === 0 ? (
              <EmptyState text="No courses in this session yet." />
            ) : (
              sessionCourses.map((course) => (
                <CourseItem
                  key={course._id}
                  course={course}
                  onOpen={() => openCourse(course)}
                  onEdit={() => openEditModal("course", course)}
                />
              ))
            )}
          </ManagementColumn>

          {/* ========================================
              SUBJECTS
          ========================================= */}

          <ManagementColumn
            eyebrow="02"
            title="Subjects"
            description="Create reusable subjects for your courses."
            count={subjects.length}
            actionLabel="+ Add subject"
            onAdd={() => openCreateModal("subject")}
          >
            {subjects.length === 0 ? (
              <EmptyState text="No subjects created yet." />
            ) : (
              subjects.map((subject) => (
                <SubjectItem
                  key={subject._id}
                  subject={subject}
                  onEdit={() => openEditModal("subject", subject)}
                />
              ))
            )}
          </ManagementColumn>

          {/* ========================================
              FACULTY
          ========================================= */}

          <ManagementColumn
            eyebrow="03"
            title="Faculty"
            description="Manage faculty members available for scheduling."
            count={faculty.length}
            actionLabel="+ Add faculty"
            onAdd={() => openCreateModal("faculty")}
          >
            {faculty.length === 0 ? (
              <EmptyState text="No faculty added yet." />
            ) : (
              faculty.map((teacher) => (
                <FacultyItem
                  key={teacher._id}
                  faculty={teacher}
                  onEdit={() => openEditModal("faculty", teacher)}
                />
              ))
            )}
          </ManagementColumn>

          {/* ========================================
              VENUES
          ========================================= */}

          <ManagementColumn
            eyebrow="04"
            title="Venues"
            description="Manage classrooms and labs used by the timetable."
            count={venues.length}
            actionLabel="+ Add venue"
            onAdd={() => openCreateModal("venue")}
          >
            {venues.length === 0 ? (
              <EmptyState text="No venues added yet." />
            ) : (
              venues.map((venue) => (
                <VenueItem
                  key={venue._id}
                  venue={venue}
                  onEdit={() => openEditModal("venue", venue)}
                />
              ))
            )}
          </ManagementColumn>
        </section>
      )}

      {/* ==========================================
          SESSION MODAL
      =========================================== */}

      {showSessionModal && (
        <SessionModal
          sessions={sessions}
          selectedSession={selectedSession}
          onSelect={selectSession}
          onCreate={handleCreateSession}
          canClose={Boolean(selectedSession)}
          onClose={() => setShowSessionModal(false)}
        />
      )}

      {/* ==========================================
          CREATE / EDIT MODALS
      =========================================== */}

      {modalType === "course" && (
        <CourseModal
          course={editingItem}
          session={selectedSession}
          subjects={subjects}
          faculty={faculty}
          onClose={closeModal}
          onSaved={loadData}
        />
      )}

      {modalType === "subject" && (
        <SubjectModal
          subject={editingItem}
          onClose={closeModal}
          onSaved={loadData}
        />
      )}

      {modalType === "faculty" && (
        <FacultyModal
          faculty={editingItem}
          onClose={closeModal}
          onSaved={loadData}
        />
      )}

      {modalType === "venue" && (
        <VenueModal
          venue={editingItem}
          onClose={closeModal}
          onSaved={loadData}
        />
      )}
    </main>
  );
}

// ==================================================
// MANAGEMENT COLUMN
// ==================================================

function ManagementColumn({
  eyebrow,
  title,
  description,
  count,
  actionLabel,
  onAdd,
  children,
}) {
  return (
    <section className={styles.managementColumn}>
      <div className={styles.columnHeader}>
        <div>
          <span className={styles.columnEyebrow}>{eyebrow}</span>

          <div className={styles.columnTitleRow}>
            <h2>{title}</h2>

            <span className={styles.count}>{count}</span>
          </div>

          <p>{description}</p>
        </div>

        <button type="button" className={styles.addButton} onClick={onAdd}>
          {actionLabel}
        </button>
      </div>

      <div className={styles.items}>{children}</div>
    </section>
  );
}

// ==================================================
// COURSE ITEM
// ==================================================

function CourseItem({ course, onOpen, onEdit }) {
  const subjectCount = Array.isArray(course.subjects)
    ? course.subjects.length
    : 0;

  return (
    <article className={styles.item}>
      <button type="button" className={styles.itemMain} onClick={onOpen}>
        <div className={styles.itemIcon}>{getInitials(course.courseId)}</div>

        <div className={styles.itemInfo}>
          <strong>{course.courseId}</strong>

          <span>
            Semester {course.semester}
            {" · "}
            {subjectCount} subject
            {subjectCount !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      <button type="button" className={styles.editButton} onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

// ==================================================
// SUBJECT ITEM
// ==================================================

function SubjectItem({ subject, onEdit }) {
  const ltp = Array.isArray(subject.ltp) ? subject.ltp : [0, 0, 0];

  return (
    <article className={styles.item}>
      <div className={styles.itemMain}>
        <div className={styles.itemIcon}>{getInitials(subject.subjectId)}</div>

        <div className={styles.itemInfo}>
          <strong>{subject.name}</strong>

          <span>
            {subject.subjectId}
            {" · "}L{ltp[0]} T{ltp[1]} P{ltp[2]}
          </span>
        </div>
      </div>

      <button type="button" className={styles.editButton} onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

// ==================================================
// FACULTY ITEM
// ==================================================

function FacultyItem({ faculty, onEdit }) {
  return (
    <article className={styles.item}>
      <div className={styles.itemMain}>
        <div className={styles.itemIcon}>{getInitials(faculty.name)}</div>

        <div className={styles.itemInfo}>
          <strong>{faculty.name}</strong>

          <span>
            {faculty.facultyId}
            {" · "}
            {faculty.designation}
          </span>
        </div>
      </div>

      <button type="button" className={styles.editButton} onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

// ==================================================
// VENUE ITEM
// ==================================================

function VenueItem({ venue, onEdit }) {
  return (
    <article className={styles.item}>
      <div className={styles.itemMain}>
        <div className={styles.itemIcon}>{getInitials(venue.roomNo)}</div>

        <div className={styles.itemInfo}>
          <strong>{venue.roomNo}</strong>

          <span>
            {venue.type}
            {" · "}
            {venue.capacity} seats
          </span>
        </div>
      </div>

      <button type="button" className={styles.editButton} onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

// ==================================================
// EMPTY STATE
// ==================================================

function EmptyState({ text }) {
  return <div className={styles.empty}>{text}</div>;
}

// ==================================================
// SESSION MODAL
// ==================================================

function SessionModal({
  sessions,
  selectedSession,
  onSelect,
  onCreate,
  canClose,
  onClose,
}) {
  const [mode, setMode] = useState(sessions.length > 0 ? "select" : "create");

  const [sessionId, setSessionId] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  async function submitCreate(event) {
    event.preventDefault();

    if (!sessionId.trim()) {
      setError("Enter a session such as MO26 or SP26.");

      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await onCreate(sessionId.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.sessionModal}>
        <div className={styles.modalTop}>
          <div>
            <span className={styles.modalEyebrow}>CLASSGRID</span>

            <h2>Select academic session</h2>

            <p>
              Choose an existing session or create a new one to start managing
              your timetable.
            </p>
          </div>

          {canClose && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.modalTabs}>
          {sessions.length > 0 && (
            <button
              type="button"
              className={mode === "select" ? styles.activeTab : ""}
              onClick={() => setMode("select")}
            >
              Existing sessions
            </button>
          )}

          <button
            type="button"
            className={mode === "create" ? styles.activeTab : ""}
            onClick={() => setMode("create")}
          >
            Create new
          </button>
        </div>

        {mode === "select" && sessions.length > 0 && (
          <div className={styles.sessionList}>
            {sessions.map((session) => (
              <button
                type="button"
                key={session._id}
                className={
                  session._id === selectedSession?._id
                    ? styles.sessionOptionActive
                    : styles.sessionOption
                }
                onClick={() => onSelect(session)}
              >
                <span>{session.sessionId}</span>

                <small>
                  {Array.isArray(session.courses) ? session.courses.length : 0}{" "}
                  courses
                </small>
              </button>
            ))}
          </div>
        )}

        {mode === "create" && (
          <form className={styles.form} onSubmit={submitCreate}>
            <label>
              Session ID
              <input
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="MO26"
                maxLength={4}
                autoFocus
              />
            </label>

            <span className={styles.fieldHint}>Use MO26, MO27, SP26, etc.</span>

            {error && <div className={styles.formError}>{error}</div>}

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create session"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ==================================================
// COURSE MODAL
// ==================================================

function CourseModal({ course, session, subjects, faculty, onClose, onSaved }) {
  const isEdit = Boolean(course);

  const [courseId, setCourseId] = useState(course?.courseId || "");

  const [semester, setSemester] = useState(course?.semester || "");

  const [noOfStudents, setNoOfStudents] = useState(course?.noOfStudents || "");

  const [selectedSubjects, setSelectedSubjects] = useState(
    course?.subjects
      ?.map((item) => item?.subject?._id || item?.subject)
      .filter(Boolean) || [],
  );

  const [subjectFaculty, setSubjectFaculty] = useState(() => {
    const result = {};

    if (Array.isArray(course?.subjects)) {
      course.subjects.forEach((item) => {
        const subjectId = item?.subject?._id || item?.subject;

        const facultyId = item?.faculty?._id || item?.faculty;

        if (subjectId && facultyId) {
          result[subjectId] = facultyId;
        }
      });
    }

    return result;
  });

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  function toggleSubject(subjectId) {
    setSelectedSubjects((previous) => {
      if (previous.includes(subjectId)) {
        const next = previous.filter((id) => id !== subjectId);

        setSubjectFaculty((current) => {
          const copy = {
            ...current,
          };

          delete copy[subjectId];

          return copy;
        });

        return next;
      }

      return [...previous, subjectId];
    });
  }

  function setFacultyForSubject(subjectId, facultyId) {
    setSubjectFaculty((previous) => ({
      ...previous,
      [subjectId]: facultyId,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (!session?._id) {
      setError("Please select a session first.");

      return;
    }

    if (!courseId.trim()) {
      setError("Course ID is required.");

      return;
    }

    try {
      setSubmitting(true);
      setError("");

      // --------------------------------------------
      // Create course
      // --------------------------------------------

      if (!isEdit) {
        const response = await apiRequest("/courses", {
          method: "POST",

          body: JSON.stringify({
            courseId: courseId.trim(),

            sessionId: session.sessionId,

            semester: Number(semester),

            noOfStudents: Number(noOfStudents),

            subjects: selectedSubjects.map((id) => {
              const subject = subjects.find((item) => item._id === id);

              return {
                subjectId: subject?.subjectId,
              };
            }),
          }),
        });

        /*
         * At this stage the course is
         * created with its subjects.
         *
         * Faculty assignment can be
         * connected to a course-update
         * endpoint once that endpoint
         * is added to the backend.
         */

        await onSaved();

        onClose();

        return;
      }

      // --------------------------------------------
      // Edit course
      // --------------------------------------------

      /*
       * Your current backend does not
       * yet have a PUT /api/courses/:id
       * endpoint.
       *
       * Therefore we don't silently
       * pretend that editing works.
       *
       * Add that endpoint next and
       * this form can use it.
       */

      setError("Course editing needs the course update endpoint.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEdit ? "Edit course" : "Add course"}
      subtitle={
        isEdit
          ? "Update course information."
          : `Create a course inside ${session?.sessionId || "the selected session"}.`
      }
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Course / Section
            <input
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              placeholder="BTECH1A"
            />
          </label>

          <label>
            Semester
            <input
              type="number"
              min="1"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              placeholder="1"
            />
          </label>

          <label>
            Students
            <input
              type="number"
              min="1"
              value={noOfStudents}
              onChange={(event) => setNoOfStudents(event.target.value)}
              placeholder="60"
            />
          </label>

          <label>
            Session
            <input value={session?.sessionId || ""} disabled />
          </label>
        </div>

        <div className={styles.assignmentSection}>
          <div className={styles.assignmentHeader}>
            <div>
              <h3>Subjects</h3>

              <p>Select existing subjects for this course.</p>
            </div>
          </div>

          {subjects.length === 0 ? (
            <EmptyState text="Create subjects first." />
          ) : (
            <div className={styles.subjectPicker}>
              {subjects.map((subject) => {
                const selected = selectedSubjects.includes(subject._id);

                return (
                  <div
                    key={subject._id}
                    className={
                      selected
                        ? styles.subjectChoiceActive
                        : styles.subjectChoice
                    }
                  >
                    <label className={styles.subjectCheck}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSubject(subject._id)}
                      />

                      <span>
                        <strong>{subject.name}</strong>

                        <small>{subject.subjectId}</small>
                      </span>
                    </label>

                    {selected && (
                      <select
                        value={subjectFaculty[subject._id] || ""}
                        onChange={(event) =>
                          setFacultyForSubject(subject._id, event.target.value)
                        }
                      >
                        <option value="">Select faculty</option>

                        {faculty.map((teacher) => (
                          <option key={teacher._id} value={teacher._id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create course"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ==================================================
// SUBJECT MODAL
// ==================================================

function SubjectModal({ subject, onClose, onSaved }) {
  const isEdit = Boolean(subject);

  const [subjectId, setSubjectId] = useState(subject?.subjectId || "");

  const [name, setName] = useState(subject?.name || "");

  const [noOfClasses, setNoOfClasses] = useState(subject?.noOfClasses || "");

  const [type, setType] = useState(subject?.type || "theory");

  const [credits, setCredits] = useState(subject?.credits || "");

  const [l, setL] = useState(subject?.ltp?.[0] ?? 0);

  const [t, setT] = useState(subject?.ltp?.[1] ?? 0);

  const [p, setP] = useState(subject?.ltp?.[2] ?? 0);

  const [category, setCategory] = useState(subject?.category || "course");

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      if (isEdit) {
        setError("Subject editing needs the subject update endpoint.");

        return;
      }

      await apiRequest("/subjects", {
        method: "POST",

        body: JSON.stringify({
          subjectId: subjectId.trim(),

          name: name.trim(),

          noOfClasses: Number(noOfClasses),

          type,

          credits: Number(credits),

          ltp: [Number(l), Number(t), Number(p)],

          category,
        }),
      });

      await onSaved();

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEdit ? "Edit subject" : "Add subject"}
      subtitle="Create a reusable subject for your courses."
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Subject ID
            <input
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder="DSA"
            />
          </label>

          <label>
            Subject name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Data Structures"
            />
          </label>

          <label>
            Number of classes
            <input
              type="number"
              min="0"
              value={noOfClasses}
              onChange={(event) => setNoOfClasses(event.target.value)}
            />
          </label>

          <label>
            Type
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="theory">Theory</option>

              <option value="lab">Lab</option>
            </select>
          </label>

          <label>
            Credits
            <input
              type="number"
              min="0"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
            />
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="course">Course</option>

              <option value="elective">Elective</option>
            </select>
          </label>
        </div>

        <div className={styles.ltpEditor}>
          <span>LTP</span>

          <label>
            L
            <input
              type="number"
              min="0"
              value={l}
              onChange={(event) => setL(event.target.value)}
            />
          </label>

          <label>
            T
            <input
              type="number"
              min="0"
              value={t}
              onChange={(event) => setT(event.target.value)}
            />
          </label>

          <label>
            P
            <input
              type="number"
              min="0"
              value={p}
              onChange={(event) => setP(event.target.value)}
            />
          </label>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <ModalActions
          onClose={onClose}
          submitting={submitting}
          label={isEdit ? "Save changes" : "Create subject"}
        />
      </form>
    </ModalShell>
  );
}

// ==================================================
// FACULTY MODAL
// ==================================================

function FacultyModal({ faculty, onClose, onSaved }) {
  const isEdit = Boolean(faculty);

  const [facultyId, setFacultyId] = useState(faculty?.facultyId || "");

  const [name, setName] = useState(faculty?.name || "");

  const [classes, setClasses] = useState(faculty?.noOfClassesPerWeek || "");

  const [designation, setDesignation] = useState(
    faculty?.designation || "Assistant Professor",
  );

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      if (isEdit) {
        setError("Faculty editing needs the faculty update endpoint.");

        return;
      }

      await apiRequest("/faculty", {
        method: "POST",

        body: JSON.stringify({
          facultyId: facultyId.trim(),

          name: name.trim(),

          noOfClassesPerWeek: Number(classes),

          designation,
        }),
      });

      await onSaved();

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEdit ? "Edit faculty" : "Add faculty"}
      subtitle="Add a faculty member who can be assigned to course subjects."
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Faculty ID
            <input
              value={facultyId}
              onChange={(event) => setFacultyId(event.target.value)}
              placeholder="FAC001"
            />
          </label>

          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Dr. Priya Sharma"
            />
          </label>

          <label>
            Classes per week
            <input
              type="number"
              min="0"
              value={classes}
              onChange={(event) => setClasses(event.target.value)}
            />
          </label>

          <label>
            Designation
            <select
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
            >
              <option>Assistant Professor</option>

              <option>Professor</option>

              <option>HOD</option>
            </select>
          </label>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <ModalActions
          onClose={onClose}
          submitting={submitting}
          label={isEdit ? "Save changes" : "Create faculty"}
        />
      </form>
    </ModalShell>
  );
}

// ==================================================
// VENUE MODAL
// ==================================================

function VenueModal({ venue, onClose, onSaved }) {
  const isEdit = Boolean(venue);

  const [roomNo, setRoomNo] = useState(venue?.roomNo || "");

  const [capacity, setCapacity] = useState(venue?.capacity || "");

  const [type, setType] = useState(venue?.type || "class");

  const [category, setCategory] = useState(venue?.category || "");

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      if (isEdit) {
        setError("Venue editing needs the venue update endpoint.");

        return;
      }

      await apiRequest("/rooms", {
        method: "POST",

        body: JSON.stringify({
          roomNo: roomNo.trim(),

          capacity: Number(capacity),

          type,

          category: category.trim() || undefined,
        }),
      });

      await onSaved();

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEdit ? "Edit venue" : "Add venue"}
      subtitle="Add a classroom or laboratory for timetable scheduling."
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Room number
            <input
              value={roomNo}
              onChange={(event) => setRoomNo(event.target.value)}
              placeholder="204"
            />
          </label>

          <label>
            Capacity
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="60"
            />
          </label>

          <label>
            Type
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="class">Classroom</option>

              <option value="lab">Laboratory</option>
            </select>
          </label>

          <label>
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="regular"
            />
          </label>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <ModalActions
          onClose={onClose}
          submitting={submitting}
          label={isEdit ? "Save changes" : "Create venue"}
        />
      </form>
    </ModalShell>
  );
}

// ==================================================
// GENERIC MODAL SHELL
// ==================================================

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.formModal}>
        <div className={styles.formModalHeader}>
          <div>
            <span className={styles.modalEyebrow}>CLASSGRID</span>

            <h2>{title}</h2>

            <p>{subtitle}</p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// ==================================================
// MODAL ACTIONS
// ==================================================

function ModalActions({ onClose, submitting, label }) {
  return (
    <div className={styles.modalActions}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onClose}
      >
        Cancel
      </button>

      <button
        type="submit"
        className={styles.primaryButton}
        disabled={submitting}
      >
        {submitting ? "Saving..." : label}
      </button>
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

function getInitials(value = "") {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
