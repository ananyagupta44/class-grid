"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import TabSwitcher from "../../components/TabSwitcher";
import EntitySelector from "../../components/EntitySelector";
import TimetableGrid from "../../components/TimetableGrid";
import RightPanel from "../../components/RightPanel";
import FacultyLegend from "../../components/FacultyLegend";
import EditClassModal from "../../components/EditClassModal";

import styles from "./dashboard.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || value.id || "";
}

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
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlCourseId = searchParams.get("courseId");

  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);

  const [faculties, setFaculties] = useState([]);

  const [venues, setVenues] = useState([]);

  const [entries, setEntries] = useState([]);

  const [legend, setLegend] = useState([]);

  const [days, setDays] = useState([]);

  const [periods, setPeriods] = useState([]);

  const [facultyTimetables, setFacultyTimetables] = useState([]);

  const [venueTimetables, setVenueTimetables] = useState([]);

  const [viewType, setViewType] = useState("course");

  const [selectedId, setSelectedId] = useState("");

  const [modalState, setModalState] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  /*
   * LOAD COURSES
   */

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await apiRequest("/courses");

        const data = response.courses || [];

        setCourses(data);

        if (!urlCourseId && data.length) {
          router.replace(`/dashboard?courseId=${data[0]._id}`);
        }
      } catch (err) {
        console.error("LOAD COURSES:", err);

        setError(err.message);
      }
    }

    loadCourses();
  }, [urlCourseId, router]);

  /*
   * LOAD EVERYTHING FOR SELECTED COURSE
   */

  useEffect(() => {
    if (!urlCourseId) {
      return;
    }

    async function loadDashboard() {
  if (!urlCourseId) {
    return;
  }

  try {
    setLoading(true);
    setError("");

    const [
      coursesResponse,
      facultyResponse,
      roomsResponse,
      timetableResponse,
    ] = await Promise.all([
      apiRequest("/courses"),
      apiRequest("/faculty"),
      apiRequest("/rooms"),
      apiRequest(
        `/timetable?courseId=${urlCourseId}`,
      ),
    ]);

    const allCourses =
      coursesResponse.courses || [];

    const allFaculties =
      facultyResponse.faculty || [];

    const allVenues =
      roomsResponse.rooms || [];

    const timetableEntries =
      timetableResponse.entries || [];

    const selectedCourse =
      allCourses.find(
        (item) =>
          item._id === urlCourseId,
      );

    setCourses(allCourses);

    setCourse(
      selectedCourse || null,
    );

    setFaculties(
      allFaculties,
    );

    setVenues(
      allVenues,
    );

    setEntries(
      timetableEntries,
    );

    /*
     * Keep these arrays safe even if
     * backend does not return them.
     */
    setFacultyTimetables([]);
    setVenueTimetables([]);

    /*
     * We will generate legend from
     * course.subjects for now.
     */
    setLegend([]);

    /*
     * Keep your existing timetable
     * configuration.
     */
    setDays([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);

    setPeriods([
      {
        id: "p1",
        label: "09:00 - 10:00",
        isBreak: false,
      },
      {
        id: "p2",
        label: "10:00 - 11:00",
        isBreak: false,
      },
      {
        id: "p3",
        label: "11:00 - 12:00",
        isBreak: false,
      },
      {
        id: "break1",
        label: "12:00 - 12:30",
        isBreak: true,
      },
      {
        id: "p4",
        label: "12:30 - 01:30",
        isBreak: false,
      },
      {
        id: "p5",
        label: "01:30 - 02:30",
        isBreak: false,
      },
      {
        id: "p6",
        label: "02:30 - 03:30",
        isBreak: false,
      },
      {
        id: "p7",
        label: "03:30 - 04:30",
        isBreak: false,
      },
    ]);
  } catch (err) {
    console.error(
      "LOAD DASHBOARD:",
      err,
    );

    setError(err.message);

    setCourse(null);
    setEntries([]);
    setLegend([]);
    setFacultyTimetables([]);
    setVenueTimetables([]);
  } finally {
    setLoading(false);
  }
}

    loadDashboard();
  }, [urlCourseId]);

  /*
   * CURRENT COURSE
   *
   * Comes entirely from backend.
   */

  const currentCourse = course;

  /*
   * COURSE CHANGE
   */

  function handleCourseChange(courseId) {
    if (!courseId) return;

    router.push(`/dashboard?courseId=${courseId}`);
  }

  /*
   * TAB
   */

  function handleTabChange(next) {
    setViewType(next);

    if (next === "faculty") {
      setSelectedId(faculties[0]?._id || faculties[0]?.id || "");
    }

    if (next === "venue") {
      setSelectedId(venues[0]?._id || venues[0]?.id || "");
    }

    if (next === "course") {
      setSelectedId("");
    }
  }

  /*
   * SELECTED FACULTY / VENUE
   */

  useEffect(() => {
    if (viewType === "faculty" && !selectedId && faculties.length) {
      setSelectedId(faculties[0]._id || faculties[0].id);
    }

    if (viewType === "venue" && !selectedId && venues.length) {
      setSelectedId(venues[0]._id || venues[0].id);
    }
  }, [viewType, selectedId, faculties, venues]);

  /*
   * MAIN GRID
   *
   * No frontend reconstruction of
   * backend timetable data.
   */

  const gridEntries = useMemo(() => {
    if (viewType === "course") {
      return entries;
    }

    if (!selectedId) {
      return [];
    }

    if (viewType === "faculty") {
      return entries.filter((entry) => getId(entry.faculty) === selectedId);
    }

    return entries.filter((entry) => getId(entry.venue) === selectedId);
  }, [entries, selectedId, viewType]);

  /*
   * OPEN ADD CLASS
   */

  function openAddClass(day = "", periodId = "") {
    setModalState({
      day,
      periodId,
      courseId: currentCourse?._id || currentCourse?.id || urlCourseId,
    });
  }

  /*
   * DRAG EXISTING ENTRY
   */

  async function handleDropEntry(entryId, day, periodId) {
    try {
      const response = await apiRequest(`/timetable/${entryId}`, {
        method: "PUT",

        body: JSON.stringify({
          day,
          periodId,
        }),
      });

      await reloadDashboard();

      return {
        ok: true,
        entry: response.entry,
      };
    } catch (err) {
      console.error("MOVE ENTRY:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  /*
   * DRAG LEGEND BLOCK
   */

  function handleLegendDrop(payload, day, periodId) {
    setModalState({
      day,
      periodId,

      courseId: currentCourse?._id || currentCourse?.id,

      subjectId: payload.subjectId,

      facultyId: payload.facultyId,

      blockType: payload.blockType,
    });
  }

  /*
   * EMPTY CELL
   */

  function handleCellClick(day, periodId) {
    openAddClass(day, periodId);
  }

  /*
   * EDIT
   */

  function handleEditEntry(entry) {
    setModalState({
      ...entry,

      courseId: getId(entry.course),

      subjectId: getId(entry.subject),

      facultyId: getId(entry.faculty),

      venueId: getId(entry.venue),
    });
  }

  /*
   * SAVE
   */

  async function handleSave(form) {
    try {
      const editing = Boolean(form.id);

      const payload = {
        courseId: form.courseId || urlCourseId,

        subjectId: form.subjectId,

        facultyId: form.facultyId,

        venueId: form.venueId,

        day: form.day,

        periodId: form.periodId,
      };

      const response = await apiRequest(
        editing ? `/timetable/${form.id}` : "/timetable",
        {
          method: editing ? "PUT" : "POST",

          body: JSON.stringify(payload),
        },
      );

      await reloadDashboard();

      setModalState(null);

      return {
        ok: true,
        entry: response.entry,
      };
    } catch (err) {
      console.error("SAVE CLASS:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  /*
   * DELETE
   */

  async function handleDelete(id) {
    try {
      await apiRequest(`/timetable/${id}`, {
        method: "DELETE",
      });

      await reloadDashboard();

      setModalState(null);

      return {
        ok: true,
      };
    } catch (err) {
      console.error("DELETE CLASS:", err);

      return {
        ok: false,
        reason: err.message,
      };
    }
  }

  /*
   * ASSIGN FACULTY TO SUBJECT
   */

  async function handleAssignFaculty(subjectId, facultyId) {
    try {
      await apiRequest(
        `/courses/${urlCourseId}/subjects/${subjectId}/faculty`,
        {
          method: "PATCH",

          body: JSON.stringify({
            facultyId,
          }),
        },
      );

      await reloadDashboard();
    } catch (err) {
      console.error("ASSIGN FACULTY:", err);

      setError(err.message);
    }
  }

  /*
   * RELOAD CURRENT COURSE
   */

  async function reloadDashboard() {
    if (!urlCourseId) return;

    const response = await apiRequest(`/dashboard/${urlCourseId}`);

    setCourse(response.course || null);

    setFaculties(response.faculties || []);

    setVenues(response.venues || []);

    setEntries(response.entries || []);

    setLegend(response.legend || []);

    setDays(response.config?.days || []);

    setPeriods(response.config?.periods || []);

    setFacultyTimetables(response.facultyTimetables || []);

    setVenueTimetables(response.venueTimetables || []);
  }

  /*
   * LOADING
   */

  if (loading) {
    return <div className={styles.loading}>Loading timetable...</div>;
  }

  /*
   * NO COURSE
   */

  if (!courses.length) {
    return (
      <div className={styles.emptyPage}>
        <p className={styles.kicker}>ClassGrid</p>

        <h1 className="font-display">No courses found</h1>

        <p>Create a course from the Manage page first.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* HEADER */}

      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>
            {currentCourse?.session?.sessionId || "ClassGrid"}
          </p>

          <h1 className={`font-display ${styles.title}`}>
            {currentCourse?.courseId || "Timetable"}
          </h1>

          <p className={styles.subtitle}>
            Semester {currentCourse?.semester || "—"} · Course timetable
          </p>
        </div>

        <button
          type="button"
          className={styles.addClassButton}
          onClick={() => openAddClass()}
        >
          + Add Class
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* CONTROLS */}

      <div className={styles.controls}>
        <TabSwitcher active={viewType} onChange={handleTabChange} />

        {viewType === "course" && (
          <label className={styles.coursePicker}>
            <span>Course</span>

            <select
              value={urlCourseId || ""}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              {courses.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.courseId} — Semester {item.semester}
                </option>
              ))}
            </select>
          </label>
        )}

        {viewType !== "course" && (
          <EntitySelector
            label={viewType === "faculty" ? "Faculty" : "Venue"}
            options={viewType === "faculty" ? faculties : venues}
            value={selectedId}
            onChange={setSelectedId}
            getOptionLabel={(item) =>
              item.name || item.roomNo || item.facultyId
            }
          />
        )}
      </div>

      {/* COURSE INFO */}

      {currentCourse && (
        <div className={styles.courseBanner}>
          <div>
            <span>Selected course</span>

            <strong>{currentCourse.courseId}</strong>
          </div>

          <div className={styles.bannerStats}>
            <span>Semester {currentCourse.semester}</span>

            <span>{currentCourse.noOfStudents} students</span>

            <span>{currentCourse.subjects?.length || 0} subjects</span>
          </div>
        </div>
      )}

      {/* MAIN */}

      <div className={styles.mainRow}>
        <div className={styles.gridCol}>
          <div className={styles.timetableHeader}>
            <div>
              <p className={styles.kicker}>Weekly timetable</p>

              <h2>
                {viewType === "course"
                  ? currentCourse?.courseId
                  : viewType === "faculty"
                    ? "Faculty timetable"
                    : "Venue timetable"}
              </h2>
            </div>

            <button
              type="button"
              className={styles.addClassButton}
              onClick={() => openAddClass()}
            >
              + Add Class
            </button>
          </div>

          <TimetableGrid
            days={days}
            periods={periods}
            entries={gridEntries}
            courses={courses}
            faculties={faculties}
            venues={venues}
            viewType={viewType}
            onDropEntry={handleDropEntry}
            onLegendDrop={viewType === "course" ? handleLegendDrop : undefined}
            onCellClick={handleCellClick}
            onEditEntry={handleEditEntry}
          />

          {viewType === "course" && (
            <FacultyLegend
              legend={legend}
              faculties={faculties}
              onAssignFaculty={handleAssignFaculty}
              onDrop={handleLegendDrop}
            />
          )}
        </div>

        {viewType === "course" && (
          <RightPanel
            facultyTimetables={facultyTimetables}
            venueTimetables={venueTimetables}
            days={days}
            periods={periods}
            courses={courses}
            faculties={faculties}
            venues={venues}
          />
        )}
      </div>

      {/* MODAL */}

      <EditClassModal
        open={Boolean(modalState)}
        initial={modalState}
        course={currentCourse}
        courses={courses}
        faculties={faculties}
        venues={venues}
        days={days}
        periods={periods}
        onClose={() => setModalState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
