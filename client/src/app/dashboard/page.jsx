"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import TabSwitcher from "../../components/TabSwitcher";
import EntitySelector from "../../components/EntitySelector";
import TimetableGrid from "../../components/TimetableGrid";
import RightPanel from "../../components/RightPanel";
import FacultyLegend from "../../components/FacultyLegend";
import PrintPicker from "../../components/PrintPicker";
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
  const { entries, setEntries, addEntry, updateEntry, addComboEntry } =
    useTimetable();

  const urlCourseId = searchParams.get("courseId");

  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [venueSearch, setVenueSearch] = useState("");
  const [faculties, setFaculties] = useState([]);
  const [venues, setVenues] = useState([]);
  const [legend, setLegend] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Timetable structure comes from frontend
  const days = DAYS;
  const periods = PERIODS;

  const [facultyTimetables, setFacultyTimetables] = useState([]);

  const [venueTimetables, setVenueTimetables] = useState([]);

  const [warning, setWarning] = useState("");

  const [viewType, setViewType] = useState("course");

  // const [selectedId, setSelectedId] = useState("");

  const [modalState, setModalState] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // legend chip chosen via click (touch / click-to-place alternative to drag)
  const [selectedBlock, setSelectedBlock] = useState(null);

  const [facultySearch, setFacultySearch] = useState("");

  // faculty / venue download: picker dialog + ids chosen for printing
  const [pickerOpen, setPickerOpen] = useState(false);
  const [printIds, setPrintIds] = useState(null);

  // once the print-only pages are rendered, open the print dialog;
  // clear them again when printing is done / cancelled
  useEffect(() => {
    if (!printIds) return;

    const done = () => setPrintIds(null);

    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => window.print(), 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printIds]);

  // Esc: close the clash popup first, otherwise cancel a pending placement
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "Escape") return;

      if (warning) {
        setWarning("");
      } else if (selectedBlock) {
        setSelectedBlock(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [warning, selectedBlock]);

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

        setCourse(response.course || null);

        setFaculties(response.faculties || []);

        setVenues(response.venues || []);

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

        const timetableResponse = await apiRequest("/timetable");

        setEntries(timetableResponse.entries || []);
      } catch (err) {
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
    setSelectedBlock(null);
    setPickerOpen(false);
    setViewType(next);
  }

  /*
   * SELECTED FACULTY / VENUE
   */

  // useEffect(() => {
  //   if (viewType === "faculty" && !selectedId && faculties.length) {
  //     setSelectedId(faculties[0]._id || faculties[0].id);
  //   }

  //   if (viewType === "venue" && !selectedId && venues.length) {
  //     setSelectedId(venues[0]._id || venues[0].id);
  //   }
  // }, [viewType, selectedId, faculties, venues]);

  /*
   * MAIN GRID
   */

  const gridEntries = useMemo(() => {
    if (viewType === "course") {
      return entries.filter((entry) => {
        const belongsToCurrentCourse =
          getId(entry.course) === urlCourseId || entry.courseId === urlCourseId;

        const belongsToComboWithCurrentCourse =
          entry.comboGroupId &&
          entries.some(
            (other) =>
              other.comboGroupId === entry.comboGroupId &&
              (getId(other.course) === urlCourseId ||
                other.courseId === urlCourseId),
          );

        return belongsToCurrentCourse || belongsToComboWithCurrentCourse;
      });
    }

    if (viewType === "faculty") {
      return [];
    }

    return [];
  }, [entries, urlCourseId, viewType]);

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

  const venueTimetableEntries = useMemo(() => {
    return venues.map((venue) => {
      const venueId = String(venue._id);

      const venueEntries = entries.filter(
        (entry) =>
          String(entry.venueId) === venueId ||
          String(entry.venue?._id) === venueId,
      );

      return {
        venue,
        entries: venueEntries,
      };
    });
  }, [venues, entries]);

  // ADD this useMemo right after your existing `venueTimetableEntries` useMemo.
  // It filters the already-computed venueTimetableEntries by the search box,
  // matching on room number, name, or type/category.

  const filteredVenueTimetableEntries = useMemo(() => {
    const query = venueSearch.trim().toLowerCase();

    if (!query) return venueTimetableEntries;

    return venueTimetableEntries.filter(({ venue }) => {
      const haystack = [venue.roomNo, venue.name, venue.type, venue.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [venueTimetableEntries, venueSearch]);

  const filteredFacultyCards = useMemo(() => {
    const query = facultySearch.trim().toLowerCase();

    if (!query) return facultyCards;

    return facultyCards.filter((card) =>
      [card.title, card.subtitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [facultyCards, facultySearch]);

  /*
   * DOWNLOAD (faculty / venue): picker items + the pages to print
   */

  const pickerItems = useMemo(() => {
    if (viewType === "faculty") {
      return facultyCards.map((card) => ({
        id: String(card.id),
        label: card.title,
        sublabel: card.subtitle,
      }));
    }

    if (viewType === "venue") {
      return venueTimetableEntries.map(({ venue }) => ({
        id: String(venue._id),
        label: venue.roomNo || venue.name,
        sublabel: venue.type || venue.category,
      }));
    }

    return [];
  }, [viewType, facultyCards, venueTimetableEntries]);

  const printCards = useMemo(() => {
    if (!printIds) return [];

    const chosen = new Set(printIds);

    if (viewType === "faculty") {
      return facultyCards
        .filter((card) => chosen.has(String(card.id)))
        .map((card) => ({
          id: String(card.id),
          title: card.title,
          subtitle: card.subtitle,
          entries: card.entries,
        }));
    }

    if (viewType === "venue") {
      return venueTimetableEntries
        .filter(({ venue }) => chosen.has(String(venue._id)))
        .map(({ venue, entries: venueEntries }) => ({
          id: String(venue._id),
          title: venue.roomNo || venue.name,
          subtitle: [
            venue.type || venue.category,
            venue.capacity ? `Capacity ${venue.capacity}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          entries: venueEntries,
        }));
    }

    return [];
  }, [printIds, viewType, facultyCards, venueTimetableEntries]);

  /*
   * OPEN ADD CLASS
   */

  function openAddClass(day = "", periodId = "", venueId = "") {
    if (!currentCourse) {
      setError("Please select a course first.");
      return;
    }

    setModalState({
      mode: "create",

      courseId: currentCourse._id || currentCourse.id || urlCourseId,

      subjectId: "",
      facultyId: "",
      venueId: venueId || "",

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
      const entry = entries.find(
        (item) => item.id === entryId || item._id === entryId,
      );

      if (!entry) {
        setError("Class not found.");
        return {
          ok: false,
          reason: "Class not found.",
        };
      }

      // ---------------------------------------
      // COMBO CLASS
      // ---------------------------------------
      if (entry.comboGroupId) {
        const comboEntries = entries.filter(
          (item) => item.comboGroupId === entry.comboGroupId,
        );

        if (comboEntries.length < 2) {
          setError("Combo class is incomplete.");
          return {
            ok: false,
            reason: "Combo class is incomplete.",
          };
        }

        // Move both combo entries
        for (const comboEntry of comboEntries) {
          const response = await apiRequest(
            `/timetable/${comboEntry.id || comboEntry._id}`,
            {
              method: "PUT",

              body: JSON.stringify({
                courseId: getId(comboEntry.course) || comboEntry.courseId,

                subjectId: getId(comboEntry.subject) || comboEntry.subjectId,

                facultyId: getId(comboEntry.faculty) || comboEntry.facultyId,

                venueId: getId(comboEntry.venue) || comboEntry.venueId,

                day,
                periodId,

                duration: comboEntry.duration || 1,

                comboGroupId: comboEntry.comboGroupId,
              }),
            },
          );
        }

        await reloadDashboard();

        return {
          ok: true,
          combo: true,
        };
      }

      // ---------------------------------------
      // NORMAL CLASS
      // ---------------------------------------
      const response = await apiRequest(`/timetable/${entryId}`, {
        method: "PUT",

        body: JSON.stringify({
          courseId: getId(entry.course) || entry.courseId,
          subjectId: getId(entry.subject) || entry.subjectId,
          facultyId: getId(entry.faculty) || entry.facultyId,
          venueId: getId(entry.venue) || entry.venueId,
          day,
          periodId,
          duration: entry.duration || 1,
        }),
      });

      await reloadDashboard();

      return {
        ok: true,
        entry: response.entry,
      };
    } catch (err) {
      console.error("MOVE ENTRY:", err);

      setWarning(err.message || "Cannot move class.");

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
    // a legend chip is selected → place it here (same as dropping it)
    if (selectedBlock) {
      const payload = selectedBlock;
      setSelectedBlock(null);
      handleLegendDrop(payload, day, periodId);
      return;
    }

    openAddClass(day, periodId);
  }

  function handleVenueCellClick(day, periodId, venueId) {
    openAddClass(day, periodId, venueId);
  }

  function handleVenueDrop(payload, day, periodId, venueId) {
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
    const modalData = {
      ...entry,

      courseId: getId(entry.course),

      subjectId: getId(entry.subject),

      facultyId: getId(entry.faculty),

      venueId: getId(entry.venue),
    };

    // ---------------------------------------
    // COMBO CLASS
    // ---------------------------------------
    if (entry.comboGroupId) {
      const comboEntries = entries.filter(
        (item) =>
          item.comboGroupId === entry.comboGroupId &&
          (item.id !== entry.id || item._id !== entry._id),
      );

      const comboEntry = comboEntries[0];

      if (comboEntry) {
        modalData.comboCourseId = getId(comboEntry.course);

        modalData.comboSubjectId = getId(comboEntry.subject);
      }
    }

    setModalState(modalData);
  }

  /*
   * SAVE CLASS
   */

  async function handleSave(form) {
    console.log("========== HANDLE SAVE START ==========");
    console.log("FORM:", form);
    console.log("IS COMBO:", form?.isCombo);

    try {
      // =========================
      // COMBO CLASS
      // =========================
      if (form.isCombo) {
        console.log("➡️ ENTERING COMBO BRANCH");
        console.log("COMBO FORM:", form);

        const result = await addComboEntry(form);

        console.log("➡️ COMBO RESULT:", result);

        if (result.ok) {
          await reloadDashboard();
          setModalState(null);
        }

        return result;
      }

      // =========================
      // NORMAL CLASS
      // =========================
      console.log("➡️ ENTERING NORMAL BRANCH");

      const payload = {
        ...form,
        courseId: form.courseId || currentCourse?._id || currentCourse?.id,
        duration: form.duration || 1,
      };

      console.log("➡️ PAYLOAD CREATED:", payload);

      // =========================
      // EDIT EXISTING CLASS
      // =========================
      if (form.id || form._id) {
        console.log("➡️ UPDATE BRANCH");

        const result = await updateEntry(form.id || form._id, payload);

        console.log("➡️ UPDATE RESULT:", result);

        if (result.ok) {
          await reloadDashboard();
          setModalState(null);
        }

        return result;
      }

      // =========================
      // CREATE NORMAL CLASS
      // =========================
      console.log("➡️ ABOUT TO CALL addEntry");

      const result = await addEntry(payload);

      console.log("➡️ ADD ENTRY RESULT:", result);

      if (result.ok) {
        await reloadDashboard();
        setModalState(null);
      }

      return result;
    } catch (error) {
      console.error("🔥 HANDLE SAVE ERROR:", error);

      return {
        ok: false,
        reason: error?.message || "Unable to schedule this class.",
      };
    }
  }

  /*
   * DELETE CLASS
   */

  async function handleDelete(id) {
    try {
      const entry = entries.find((item) => (item.id || item._id) === id);

      // ---------------------------------------
      // DELETE COMBO CLASS
      // ---------------------------------------
      if (entry?.comboGroupId) {
        const comboEntries = entries.filter(
          (item) => item.comboGroupId === entry.comboGroupId,
        );

        for (const comboEntry of comboEntries) {
          const comboEntryId = comboEntry.id || comboEntry._id;

          await apiRequest(`/timetable/${comboEntryId}`, {
            method: "DELETE",
          });
        }
      } else {
        // ---------------------------------------
        // DELETE NORMAL CLASS
        // ---------------------------------------
        await apiRequest(`/timetable/${id}`, {
          method: "DELETE",
        });
      }

      await reloadDashboard();
      setModalState(null);

      return { ok: true };
    } catch (error) {
      console.error("Delete failed:", error);

      return {
        ok: false,
        reason: error.message || "Failed to delete class.",
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

    try {
      const response = await apiRequest(`/dashboard/${urlCourseId}`);

      setCourse(response.course || null);
      setFaculties(response.faculties || []);
      setVenues(response.venues || []);
      setLegend(response.legend || []);
      setFacultyTimetables(response.facultyTimetables || []);
      setVenueTimetables(response.venueTimetables || []);

      // IMPORTANT: load all timetable entries
      const timetableResponse = await apiRequest("/timetable");

      setEntries(timetableResponse.entries || []);
    } catch (err) {
      console.error("RELOAD DASHBOARD:", err);
    }
  }

  /*
   * LOADING
   */

  if (loading) {
    return (
      <div
        className={styles.page}
        aria-busy="true"
        aria-label="Loading timetable"
      >
        <div className={styles.skeletonHeader}>
          <div className={`${styles.skeleton} ${styles.skeletonKicker}`} />
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        </div>

        <div className={styles.skeletonRow}>
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      </div>
    );
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

        <div className={styles.controls}>
          <TabSwitcher active={viewType} onChange={handleTabChange} />

          {viewType === "course" && (
            <label className={styles.coursePicker}>
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

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              viewType === "course" ? window.print() : setPickerOpen(true)
            }
            title={
              viewType === "course"
                ? "Print or save the course timetable as PDF"
                : "Choose which timetables to download"
            }
          >
            {viewType === "course" ? "Print / PDF" : "Download PDF"}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button
            type="button"
            className={styles.errorClose}
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* MAIN */}

      {viewType === "faculty" ? (
        /*
         * FACULTY VIEW — FULL WIDTH, ALL FACULTY TIMETABLES IN A GRID
         */
        <div className={styles.venueFullRow}>
          <div className={styles.venueView}>
            <div className={styles.viewHeader}>
              <div className={styles.venueViewHeaderRow}>
                <div>
                  <h2>Faculty Timetables</h2>
                  <p>All faculty schedules</p>
                </div>

                <div className={styles.venueSearchWrap}>
                  <input
                    type="text"
                    className={styles.venueSearchInput}
                    placeholder="Search faculty (name or designation)..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                  />

                  {facultySearch && (
                    <button
                      type="button"
                      className={styles.venueSearchClear}
                      onClick={() => setFacultySearch("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.facultyTimetableGrid}>
              {filteredFacultyCards.length === 0 && (
                <p className={styles.venueNoResults}>
                  {facultySearch
                    ? `No faculty match "${facultySearch}".`
                    : "Faculty schedules will appear here."}
                </p>
              )}

              {filteredFacultyCards.map((card) => (
                <div key={card.id} className={styles.venueTimetableCard}>
                  <div className={styles.venueHeader}>
                    <div>
                      <h3>{card.title}</h3>
                      <span>{card.subtitle || "Faculty"}</span>
                    </div>
                  </div>

                  <TimetableGrid
                    entries={card.entries}
                    days={DAYS}
                    periods={PERIODS}
                    variant="faculty"
                    courses={courses}
                    faculties={faculties}
                    venues={venues}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : viewType === "venue" ? (
        /*
         * VENUE VIEW — FULL WIDTH, NO RIGHT PANEL, NO 2-COLUMN GRID
         */
        <div className={styles.venueFullRow}>
          <div className={styles.venueView}>
            <div className={styles.viewHeader}>
              <div className={styles.venueViewHeaderRow}>
                <div>
                  <h2>Venue Timetables</h2>
                  <p>All venue schedules</p>
                </div>

                <div className={styles.venueSearchWrap}>
                  <input
                    type="text"
                    className={styles.venueSearchInput}
                    placeholder="Search venue (e.g. LAB-3, seminar hall)..."
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                  />

                  {venueSearch && (
                    <button
                      type="button"
                      className={styles.venueSearchClear}
                      onClick={() => setVenueSearch("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.venueTimetableList}>
              {filteredVenueTimetableEntries.length === 0 && (
                <p className={styles.venueNoResults}>
                  No venues match &quot;{venueSearch}&quot;.
                </p>
              )}

              {filteredVenueTimetableEntries.map(
                ({ venue, entries: venueEntries }) => (
                  <div key={venue._id} className={styles.venueTimetableCard}>
                    <div className={styles.venueHeader}>
                      <div>
                        <h3>{venue.roomNo}</h3>
                        <span>{venue.type || venue.category || "Venue"}</span>
                      </div>

                      {venue.capacity && (
                        <span>Capacity: {venue.capacity}</span>
                      )}
                    </div>

                    <TimetableGrid
                      entries={venueEntries}
                      days={DAYS}
                      periods={PERIODS}
                      variant="venue"
                      courses={courses}
                      faculties={faculties}
                      venues={venues}
                      // onCellClick={(day, periodId) =>
                      //   handleVenueCellClick(day, periodId, venue._id)
                      // }
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      ) : (
        /*
         * COURSE / FACULTY VIEW — UNCHANGED 2-COLUMN LAYOUT
         */
        <div className={styles.mainRow}>
          <div className={styles.gridCol}>
            {viewType === "course" && selectedBlock && (
              <div className={styles.placingHint} role="status">
                <span>
                  Placing <strong>{selectedBlock.label}</strong> — click a slot
                  in the timetable
                </span>

                <button type="button" onClick={() => setSelectedBlock(null)}>
                  Cancel (Esc)
                </button>
              </div>
            )}

            {viewType === "course" && (
              <div data-print-area className={styles.printArea}>
                <div className={styles.printHeader}>
                  <div>
                    <h1>Class Timetable</h1>
                    <p>
                      {currentCourse?.courseId || "—"} · Semester{" "}
                      {currentCourse?.semester || "—"}
                    </p>
                  </div>

                  <p>
                    {currentCourse?.session?.sessionId
                      ? `Session ${currentCourse.session.sessionId}`
                      : ""}
                  </p>
                </div>

                <TimetableGrid
                  entries={gridEntries}
                  days={DAYS}
                  periods={PERIODS}
                  variant="course"
                  courses={courses}
                  faculties={faculties}
                  venues={venues}
                  onDropEntry={handleDropEntry}
                  onLegendDrop={handleLegendDrop}
                  onCellClick={handleCellClick}
                  placing={Boolean(selectedBlock)}
                  onEditEntry={handleEditEntry}
                />
              </div>
            )}

            {viewType === "course" && (
              <FacultyLegend
                legend={legend}
                faculties={faculties}
                availableSubjects={availableSubjects}
                courseId={currentCourse?._id || currentCourse?.id}
                onAssignFaculty={handleAssignFaculty}
                onAddSubject={handleAddSubject}
                onAddClass={() => openAddClass()}
                onDrop={handleLegendDrop}
                selectedBlock={selectedBlock}
                onSelectBlock={setSelectedBlock}
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
              onVenueCellClick={handleVenueCellClick}
            />
          )}
        </div>
      )}

      {/* MODAL */}

      <EditClassModal
        open={Boolean(modalState)}
        initial={modalState}
        course={course}
        courses={courses}
        faculties={faculties}
        venues={venues}
        days={days}
        periods={periods}
        onClose={() => setModalState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      {warning && (
        <div className={styles.warningOverlay} onClick={() => setWarning("")}>
          <div
            className={styles.warningPopup}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="warning-title"
            aria-describedby="warning-text"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.warningIcon} aria-hidden="true">
              !
            </div>

            <h3 id="warning-title">Schedule Clash</h3>

            <p id="warning-text">{warning}</p>

            <button type="button" autoFocus onClick={() => setWarning("")}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* FACULTY / VENUE DOWNLOAD: choose whose timetables to include */}
      {pickerOpen && (viewType === "faculty" || viewType === "venue") && (
        <PrintPicker
          title={
            viewType === "faculty"
              ? "Download faculty timetables"
              : "Download venue timetables"
          }
          noun={viewType === "faculty" ? "faculty" : "venues"}
          items={pickerItems}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setPickerOpen(false);
            setPrintIds(ids);
          }}
        />
      )}

      {/* print-only pages: one chosen faculty / venue per page */}
      {printIds && printCards.length > 0 && (
        <div className={styles.printOnly}>
          {printCards.map((card) => (
            <section key={card.id} data-print-area className={styles.printPage}>
              <div className={styles.printHeader}>
                <div>
                  <h1>
                    {viewType === "faculty"
                      ? "Faculty Timetable"
                      : "Venue Timetable"}
                  </h1>
                  <p>
                    {card.title}
                    {card.subtitle ? ` · ${card.subtitle}` : ""}
                  </p>
                </div>

                <p>
                  {currentCourse?.session?.sessionId
                    ? `Session ${currentCourse.session.sessionId}`
                    : ""}
                </p>
              </div>

              <TimetableGrid
                entries={card.entries}
                days={DAYS}
                periods={PERIODS}
                variant={viewType}
                courses={courses}
                faculties={faculties}
                venues={venues}
              />
            </section>
          ))}
        </div>
      )}

      {/* PRINT: only the [data-print-area] block (course timetable) prints */}
      <style media="print">{`
        @page { size: A4 landscape; margin: 10mm; }
        html, body { background: #fff !important; }
        body *:not(:has([data-print-area])):not([data-print-area]):not([data-print-area] *) {
          display: none !important;
        }
        main { padding: 0 !important; }
        [data-print-area], [data-print-area] * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
    </div>
  );
}
