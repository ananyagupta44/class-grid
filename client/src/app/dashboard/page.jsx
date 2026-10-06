"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import TabSwitcher from "../../components/TabSwitcher";
import EntitySelector from "../../components/EntitySelector";
import TimetableGrid from "../../components/TimetableGrid";
import RightPanel from "../../components/RightPanel";
import FacultyLegend from "../../components/FacultyLegend";
import PrintPicker from "../../components/PrintPicker";
import GenerateTimetable from "../../components/GenerateTimetable";
import { withLabBlocks } from "../../components/legendBlocks";
import EditClassModal from "../../components/EditClassModal";
import { useTimetable } from "../../context/TimetableContext";
import { useAuth } from "../../context/AuthContext";

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

  /*
   * ROLE PERMISSIONS
   *   student → view course + venue timetables only, no editing
   *   staff   → edit timetable entries; sees own timetable on the faculty tab
   *   admin   → everything
   */
  const {
    user,
    ready: authReady,
    isStaff,
    isStudent,
    canEditTimetable,
    canManageCourses,
  } = useAuth();

  const allowedTabs = isStudent
    ? ["course", "venue"]
    : ["course", "faculty", "venue"];

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

  // admin: auto-generate the timetable of the whole session
  const [generateOpen, setGenerateOpen] = useState(false);
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

  // the page skeleton only shows for the very first load; switching course
  // afterwards must NOT blank the page (it would reset the scrolling feed)
  const firstLoadDone = useRef(false);

  // /timetable returns the entries of ALL courses, so it is fetched once
  const entriesLoaded = useRef(false);

  /*
   * LOAD COURSES
   */

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await apiRequest("/courses");

        const data = response.courses || [];

        setCourses((prev) =>
          prev.length === data.length &&
          prev.every((item, i) => item._id === data[i]._id)
            ? prev
            : data,
        );

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
        if (!firstLoadDone.current) setLoading(true);
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

        if (!entriesLoaded.current) {
          const timetableResponse = await apiRequest("/timetable");

          setEntries(timetableResponse.entries || []);
          entriesLoaded.current = true;
        }
      } catch (err) {
        setError(err.message);

        entriesLoaded.current = false;

        setCourse(null);
        setFaculties([]);
        setVenues([]);
        setEntries([]);
        setLegend([]);
        setFacultyTimetables([]);
        setVenueTimetables([]);
      } finally {
        setLoading(false);
        firstLoadDone.current = true;
      }
    }

    loadDashboard();
  }, [urlCourseId]);

  /*
   * CURRENT COURSE
   */

  const currentCourse = course;

  /*
   * COURSE FEED
   *
   * Every course's timetable sits in one scrolling column ("feed"). The course
   * that is mostly in view is the FOCUSED course: it is highlighted in the left
   * rail and, once scrolling settles, becomes the current course (URL, legend,
   * right panel). Clicking a course in the rail scrolls the feed to it.
   */

  const feedRef = useRef(null);
  const railRef = useRef(null);
  const [feedEl, setFeedEl] = useState(null);
  const [focusId, setFocusId] = useState(urlCourseId || "");
  const focusIdRef = useRef(urlCourseId || "");
  const ignoreObserverUntil = useRef(0);
  // URL updates this page started itself (so it can ignore them coming back)
  const pendingUrlRef = useRef(new Set());

  // stable callback ref (an inline one would re-run every render)
  const feedRefCallback = useCallback((element) => {
    feedRef.current = element;
    setFeedEl(element);
  }, []);

  function scrollToCourse(id, behavior = "smooth") {
    const feed = feedRef.current;

    if (!feed || !id) return;

    const section = feed.querySelector(`[data-course-id="${id}"]`);

    if (!section) return;

    // don't let the scroll we start ourselves change the focus on the way
    ignoreObserverUntil.current =
      Date.now() + (behavior === "smooth" ? 800 : 150);

    feed.scrollTo({ top: section.offsetTop, behavior });
  }

  function focusCourse(id, behavior = "smooth") {
    focusIdRef.current = id;
    setFocusId(id);
    scrollToCourse(id, behavior);
  }

  /*
   * COURSE CHANGE (dropdown)
   */

  function handleCourseChange(courseId) {
    if (!courseId) return;

    focusCourse(courseId);

    pendingUrlRef.current.add(courseId);
    router.push(`/dashboard?courseId=${courseId}`);
  }

  // scrolling settled on another course → make it the current course
  // (replace, not push: scrolling must not fill the browser history)
  useEffect(() => {
    if (!focusId || focusId === urlCourseId) return undefined;

    const timer = setTimeout(() => {
      pendingUrlRef.current.add(focusId);
      router.replace(`/dashboard?courseId=${focusId}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
  }, [focusId, urlCourseId, router]);

  // the URL changed from OUTSIDE (back / forward button, a link) → follow it
  useEffect(() => {
    if (!urlCourseId) return;

    // our own update coming back — nothing to do
    if (pendingUrlRef.current.delete(urlCourseId)) return;

    if (urlCourseId !== focusIdRef.current) {
      focusCourse(urlCourseId, "auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCourseId]);

  // feed just appeared (first load / returning from another tab) → jump to
  // the current course without animation
  useEffect(() => {
    if (feedEl) scrollToCourse(focusIdRef.current || urlCourseId, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedEl, courses.length]);

  // which course section is mostly visible?
  useEffect(() => {
    if (!feedEl) return undefined;

    const sections = feedEl.querySelectorAll("[data-course-id]");

    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (records) => {
        if (Date.now() < ignoreObserverUntil.current) return;

        const best = records
          .filter((record) => record.intersectionRatio >= 0.55)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const id = best?.target.getAttribute("data-course-id");

        if (id && id !== focusIdRef.current) {
          focusIdRef.current = id;
          setFocusId(id);
        }
      },
      { root: feedEl, threshold: [0.55, 0.8, 1] },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [feedEl, courses]);

  // keep the highlighted rail item visible when the rail itself scrolls
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.querySelector('[aria-current="true"]');

    if (!rail || !item) return;

    if (item.offsetTop < rail.scrollTop) {
      rail.scrollTop = item.offsetTop - 8;
    } else if (
      item.offsetTop + item.offsetHeight >
      rail.scrollTop + rail.clientHeight
    ) {
      rail.scrollTop =
        item.offsetTop + item.offsetHeight - rail.clientHeight + 8;
    }
  }, [focusId, courses]);

  useEffect(() => {
    if (isStudent && viewType === "faculty") setViewType("course");
  }, [isStudent, viewType]);

  /*
   * TAB CHANGE
   */

  function handleTabChange(next) {
    if (!allowedTabs.includes(next)) return;

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

  // the faculty record that belongs to the logged-in staff member
  // (staff ID on the account = facultyId on the faculty record)
  const ownFaculty = useMemo(() => {
    if (!isStaff || !user) return null;

    const same = (a, b) =>
      a &&
      b &&
      String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

    return (
      faculties.find((item) => same(item.facultyId, user.identifier)) ||
      faculties.find((item) => same(item.email, user.email)) ||
      null
    );
  }, [isStaff, user, faculties]);

  const ownFacultyId = ownFaculty?._id || ownFaculty?.id || "";

  // every course's entries, for the continuous feed
  const entriesByCourse = useMemo(() => {
    const map = new Map();

    for (const entry of entries) {
      const key = String(getId(entry.course) || entry.courseId || "");

      if (!key) continue;

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }

    return map;
  }, [entries]);

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

    // staff: their own timetable is the main timetable on the faculty tab
    if (viewType === "faculty" && isStaff && ownFacultyId) {
      return entries.filter((entry) => getId(entry.faculty) === ownFacultyId);
    }

    return [];
  }, [entries, urlCourseId, viewType, isStaff, ownFacultyId]);

  /*
   * FACULTY CARDS
   */

  const facultyCards = useMemo(
    () =>
      faculties.map((faculty) => ({
        id: faculty._id || faculty.id,

        title: faculty.name,

        code: faculty.facultyId,

        subtitle: faculty.designation,

        entries: entries.filter(
          (entry) => getId(entry.faculty) === (faculty._id || faculty.id),
        ),
      })),
    [faculties, entries],
  );

  // legend chips: a lab (the P in L-T-P) is ONE block of N periods,
  // not N separate one-period classes
  const legendForUi = useMemo(
    () => legend.map((item) => withLabBlocks(item, gridEntries, getId)),
    [legend, gridEntries],
  );

  // staff on the faculty tab: their own timetable is the main one,
  // so the mini timetables only list the other faculty
  const rightFacultyCards = useMemo(
    () =>
      viewType === "faculty" && isStaff
        ? facultyCards.filter((card) => card.id !== ownFacultyId)
        : facultyCards,
    [facultyCards, viewType, isStaff, ownFacultyId],
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
          heading: [card.code, card.title].filter(Boolean).join(" · "),
          subtitle: card.subtitle,
          entries: card.entries,
        }));
    }

    if (viewType === "venue") {
      return venueTimetableEntries
        .filter(({ venue }) => chosen.has(String(venue._id)))
        .map(({ venue, entries: venueEntries }) => ({
          id: String(venue._id),
          heading: venue.roomNo || venue.name,
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
    if (!canEditTimetable) return;

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
    if (!canEditTimetable) return;

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
    if (!canManageCourses) return;

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
    if (!canEditTimetable) return;

    setModalState({
      mode: "create",

      courseId: payload.courseId || currentCourse?._id || currentCourse?.id,

      subjectId: payload.subjectId,

      facultyId: payload.facultyId || "",

      day,

      periodId,

      blockType: payload.blockType,

      blockNumber: payload.blockNumber,

      // a 3-hour lab is one block of 3 periods, not 1
      duration: payload.duration || 1,
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
    if (!canEditTimetable) return;

    openAddClass(day, periodId, venueId);
  }

  function handleVenueDrop(payload, day, periodId, venueId) {
    if (!canEditTimetable) return;

    if (payload.kind === "legend") {
      setModalState({
        courseId: payload.courseId || currentCourse?._id || currentCourse?.id,

        subjectId: payload.subjectId,

        facultyId: payload.facultyId,

        venueId,

        day,
        periodId,

        duration: payload.duration || 1,
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
    if (!canEditTimetable) return;

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
    if (!canEditTimetable) return;

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
    if (!canEditTimetable) return;

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
    if (!canManageCourses) return;

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

  const feedCourses = courses.length
    ? courses
    : currentCourse
      ? [currentCourse]
      : [];

  /*
   * LOADING
   */

  if (loading || !authReady) {
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
          <TabSwitcher
            active={viewType}
            onChange={handleTabChange}
            allowedTabs={allowedTabs}
          />

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

          {canManageCourses && viewType === "course" && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setGenerateOpen(true)}
              title="Automatically generate the timetable for this session"
            >
              Auto-generate
            </button>
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

      {viewType === "faculty" && !isStaff ? (
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
                    readOnly
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
                      readOnly
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
            {viewType === "course" && canEditTimetable && selectedBlock && (
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
              <div
                className={styles.courseFeedLayout}
                style={{
                  "--feed-h": `calc(6.2rem + ${DAYS.length} * 4.7rem)`,
                }}
              >
                {/* LEFT RAIL — all courses */}
                <nav
                  className={styles.courseRail}
                  aria-label="Courses"
                  ref={railRef}
                >
                  <ul>
                    {feedCourses.map((item) => {
                      const active = String(item._id) === String(focusId);

                      return (
                        <li key={item._id}>
                          <button
                            type="button"
                            className={`${styles.railItem} ${
                              active ? styles.railItemActive : ""
                            }`}
                            aria-current={active ? "true" : undefined}
                            title={`${item.courseId} — Semester ${item.semester}`}
                            onClick={() => focusCourse(item._id)}
                          >
                            {item.courseId}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {/* CONTINUOUS FEED — one timetable after another */}
                <div
                  className={styles.feed}
                  ref={feedRefCallback}
                  tabIndex={0}
                  aria-label="Course timetables"
                >
                  {feedCourses.map((item) => {
                    const isCurrent =
                      String(currentCourse?._id) === String(item._id);

                    // only the current course (the one the legend belongs to)
                    // can be edited; the others are view-only until scrolled to
                    const editable = isCurrent && canEditTimetable;

                    return (
                      <section
                        key={item._id}
                        data-course-id={item._id}
                        className={`${styles.feedSection} ${
                          isCurrent ? styles.printArea : ""
                        }`}
                        {...(isCurrent ? { "data-print-area": "" } : {})}
                      >
                        <div className={styles.feedTitle}>
                          <strong>{item.courseId}</strong>
                          <span>Semester {item.semester}</span>
                        </div>

                        {isCurrent && (
                          <>
                            <div className={styles.printInstitute}>
                              <h2>BIRLA INSTITUTE OF TECHNOLOGY</h2>
                              <p>MESRA</p>
                              <p>OFF CAMPUS JAIPUR</p>
                            </div>

                            <div className={styles.printHeader}>
                              <div>
                                <h1>
                                  {currentCourse?.courseId || "Timetable"}
                                </h1>
                                <p>Semester {currentCourse?.semester || "—"}</p>
                              </div>

                              <p>
                                {currentCourse?.session?.sessionId
                                  ? `Session ${currentCourse.session.sessionId}`
                                  : ""}
                              </p>
                            </div>
                          </>
                        )}

                        <TimetableGrid
                          entries={entriesByCourse.get(String(item._id)) || []}
                          days={DAYS}
                          periods={PERIODS}
                          variant="course"
                          printCompact
                          readOnly={!editable}
                          courses={courses}
                          faculties={faculties}
                          venues={venues}
                          onDropEntry={editable ? handleDropEntry : undefined}
                          onLegendDrop={editable ? handleLegendDrop : undefined}
                          onCellClick={editable ? handleCellClick : undefined}
                          placing={editable && Boolean(selectedBlock)}
                          onEditEntry={editable ? handleEditEntry : undefined}
                        />

                        {isCurrent && (
                          <>
                            {/* LEGEND — prints under the timetable */}
                            {legend.length > 0 && (
                              <table className={styles.printLegend}>
                                <caption>Legend</caption>

                                <thead>
                                  <tr>
                                    <th>S.No.</th>
                                    <th>Code</th>
                                    <th>Subject name [Credits]</th>
                                    <th>Main faculty name</th>
                                    <th>Code</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {legend.map((item, index) => {
                                    const subject = item.subject || {};
                                    const teacher = item.faculty || {};

                                    return (
                                      <tr
                                        key={subject._id || subject.id || index}
                                      >
                                        <td>{index + 1}</td>
                                        <td>{subject.subjectId}</td>
                                        <td>
                                          {subject.name}
                                          {subject.credits != null &&
                                          subject.credits !== ""
                                            ? ` [${subject.credits}]`
                                            : ""}
                                        </td>
                                        <td>{teacher.name || "—"}</td>
                                        <td>{teacher.facultyId || ""}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STAFF — faculty tab: my own timetable is the main one */}
            {viewType === "faculty" && isStaff && (
              <div className={styles.myTimetable}>
                <div className={styles.venueHeader}>
                  <div>
                    <h3>
                      {ownFaculty
                        ? `My timetable — ${ownFaculty.name}`
                        : "My timetable"}
                    </h3>
                    <span>{ownFaculty?.facultyId || user?.identifier}</span>
                  </div>
                </div>

                {ownFaculty ? (
                  <TimetableGrid
                    entries={gridEntries}
                    days={DAYS}
                    periods={PERIODS}
                    variant="faculty"
                    courses={courses}
                    faculties={faculties}
                    venues={venues}
                    onDropEntry={handleDropEntry}
                    onEditEntry={handleEditEntry}
                  />
                ) : (
                  <p className={styles.venueNoResults}>
                    No faculty profile is linked to your account (staff ID{" "}
                    {user?.identifier}). Please ask an admin to check it.
                  </p>
                )}
              </div>
            )}

            {viewType === "course" && canEditTimetable && (
              <FacultyLegend
                legend={legendForUi}
                faculties={faculties}
                availableSubjects={availableSubjects}
                courseId={currentCourse?._id || currentCourse?.id}
                onAssignFaculty={handleAssignFaculty}
                onAddSubject={handleAddSubject}
                onAddClass={() => openAddClass()}
                onDrop={handleLegendDrop}
                selectedBlock={selectedBlock}
                onSelectBlock={setSelectedBlock}
                canManage={canManageCourses}
              />
            )}
          </div>

          {(viewType === "course" || (viewType === "faculty" && isStaff)) && (
            <RightPanel
              facultyCards={rightFacultyCards}
              venueCards={venueCards}
              days={days}
              periods={periods}
              courses={courses}
              faculties={faculties}
              venues={venues}
              showFaculty={!isStudent}
              readOnly={!canEditTimetable || viewType !== "course"}
              onDropBlock={handleVenueDrop}
              onVenueCellClick={handleVenueCellClick}
            />
          )}
        </div>
      )}

      {/* MODAL */}

      <EditClassModal
        open={canEditTimetable && Boolean(modalState)}
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

      {/* ADMIN: auto-generate the session's timetable */}
      {canManageCourses && (
        <GenerateTimetable
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          sessionId={currentCourse?.session?._id || currentCourse?.session}
          sessionLabel={currentCourse?.session?.sessionId}
          days={DAYS}
          periodIds={PERIODS.map((period) => period.id)}
          onDone={reloadDashboard}
        />
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
                  <h1>{card.heading}</h1>
                  {card.subtitle && <p>{card.subtitle}</p>}
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
                readOnly
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
        @page { size: A4 ${viewType === "course" ? "portrait" : "landscape"}; margin: 10mm; }
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