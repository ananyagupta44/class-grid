"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import TabSwitcher from "../../components/TabSwitcher";
import EntitySelector from "../../components/EntitySelector";
import TimetableGrid from "../../components/TimetableGrid";
import RightPanel from "../../components/RightPanel";
import FacultyLegend from "../../components/FacultyLegend";
import EditClassModal from "../../components/EditClassModal";
import { useTimetable } from "../../context/TimetableContext";

import { DAYS, PERIODS } from "../../context/TimetableContext";

import styles from "./dashboard.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getId(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

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
  const { addEntry, updateEntry } = useTimetable();

  const urlCourseId = searchParams.get("courseId");

  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);

  const [faculties, setFaculties] = useState([]);
  const [venues, setVenues] = useState([]);
  const [entries, setEntries] = useState([]);
  const [legend, setLegend] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Timetable structure comes from frontend
  const days = DAYS;
  const periods = PERIODS;

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
    if (!urlCourseId) return;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await apiRequest(`/dashboard/${urlCourseId}`);

        console.log("FULL DASHBOARD RESPONSE:", response);

        console.log("COURSE SUBJECTS:", response.course?.subjects || []);

        console.log("LEGEND:", response.legend || []);

        setCourse(response.course || null);

        setFaculties(response.faculties || []);

        setVenues(response.venues || []);

        setEntries(response.entries || []);

        setLegend(response.legend || []);

        setAvailableSubjects(response.availableSubjects || []);

        /*
         * DO NOT SET DAYS/PERIODS FROM BACKEND.
         *
         * They come from:
         * TimetableContext -> DAYS
         * TimetableContext -> PERIODS
         */

        setFacultyTimetables(response.facultyTimetables || []);

        setVenueTimetables(response.venueTimetables || []);
      } catch (err) {
        console.error("LOAD DASHBOARD:", err);

        setError(err.message);

        setCourse(null);
        setFaculties([]);
        setVenues([]);
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
   * TAB CHANGE
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
   * FACULTY CARDS
   */

  const facultyCards = useMemo(
    () =>
      faculties.map((faculty) => ({
        id: faculty._id || faculty.id,

        title: faculty.name,

        subtitle: faculty.designation,

        entries: entries.filter(
          (entry) => getId(entry.faculty) === (faculty._id || faculty.id),
        ),
      })),
    [faculties, entries],
  );

  /*
   * VENUE CARDS
   */

  const venueCards = useMemo(
    () =>
      venues.map((venue) => ({
        id: venue._id || venue.id,

        title: venue.roomNo || venue.name,

        subtitle: venue.type,

        entries: entries.filter(
          (entry) => getId(entry.venue) === (venue._id || venue.id),
        ),
      })),
    [venues, entries],
  );

  /*
   * OPEN ADD CLASS
   */

  function openAddClass(day = "", periodId = "") {
    if (!currentCourse) {
      setError("Please select a course first.");
      return;
    }

    setModalState({
      mode: "create",

      courseId: currentCourse._id || currentCourse.id || urlCourseId,

      subjectId: "",
      facultyId: "",
      venueId: "",

      day,
      periodId,

      duration: 1,
    });
  }

  /*
   * MOVE EXISTING ENTRY
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

  async function handleAddSubject(subjectId) {
    try {
      const courseId = currentCourse?._id || currentCourse?.id;

      const response = await apiRequest(`/courses/${courseId}/subjects`, {
        method: "POST",
        body: JSON.stringify({
          subjectId,
        }),
      });

      console.log("SUBJECT ADDED:", response);

      await reloadDashboard();
    } catch (error) {
      console.error("ADD SUBJECT ERROR:", error);
    }
  }

  /*
   * DROP LEGEND BLOCK
   */

  function handleLegendDrop(payload, day, periodId) {
    setModalState({
      mode: "create",

      courseId: payload.courseId || currentCourse?._id || currentCourse?.id,

      subjectId: payload.subjectId,

      facultyId: payload.facultyId || "",

      day,

      periodId,

      blockType: payload.blockType,

      blockNumber: payload.blockNumber,

      duration: 1,
    });
  }

  /*
   * EMPTY CELL
   */

  function handleCellClick(day, periodId) {
    openAddClass(day, periodId);
  }

  function handleVenueDrop(payload, day, periodId, venueId) {
    console.log("VENUE DROP:", payload, day, periodId, venueId);

    if (payload.kind === "legend") {
      setModalState({
        courseId: payload.courseId || currentCourse?._id || currentCourse?.id,

        subjectId: payload.subjectId,

        facultyId: payload.facultyId,

        venueId,

        day,
        periodId,
      });

      return;
    }

    if (payload.kind === "class-block") {
      handleDropEntry(payload.id, day, periodId);
    }
  }

  /*
   * EDIT ENTRY
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
   * SAVE CLASS
   */

  async function handleSave(form) {
    const payload = {
      ...form,

      courseId: form.courseId || currentCourse?._id || currentCourse?.id,

      duration: form.duration || 1,
    };

    if (form.id || form._id) {
      const id = form.id || form._id;

      const result = await updateEntry(id, payload);

      if (result.ok) {
        setModalState(null);
      }

      return result;
    }

    const result = await addEntry(payload);

    if (result.ok) {
      setModalState(null);
    }

    return result;
  }

  /*
   * DELETE CLASS
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
   * ASSIGN FACULTY
   */

  async function handleAssignFaculty(subjectId, facultyId) {
    try {
      const response = await apiRequest(
        `/courses/${course._id}/subjects/${subjectId}/faculty`,
        {
          method: "PATCH",

          body: JSON.stringify({
            facultyId,
          }),
        },
      );

      console.log("FACULTY ASSIGNED:", response);

      await reloadDashboard();
    } catch (error) {
      console.error("ASSIGN FACULTY ERROR:", error);
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

    /*
     * Do NOT update days/periods here.
     * They remain the frontend constants.
     */

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

  console.log("ADD CLASS DEBUG:", {
    currentCourse,
    modalState,
    course,
    subjects: course?.subjects,
  });

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
            onLegendDrop={handleLegendDrop}
            onCellClick={handleCellClick}
            onEditEntry={handleEditEntry}
          />

          {viewType === "course" && (
            <FacultyLegend
              legend={legend}
              faculties={faculties}
              availableSubjects={availableSubjects}
              courseId={currentCourse?._id || currentCourse?.id}
              onAssignFaculty={handleAssignFaculty}
              onAddSubject={handleAddSubject}
              onDrop={handleLegendDrop}
            />
          )}
        </div>

        {viewType === "course" && (
          <RightPanel
            facultyCards={facultyCards}
            venueCards={venueCards}
            days={days}
            periods={periods}
            courses={courses}
            faculties={faculties}
            venues={venues}
            onDropBlock={handleVenueDrop}
          />
        )}
      </div>

      {/* MODAL */}

      <EditClassModal
        open={Boolean(modalState)}
        initial={modalState}
        course={course}
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
