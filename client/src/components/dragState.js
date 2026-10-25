"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * Shared "what is being dragged right now" + auto-scroll while dragging.
 *
 * Why: the browser only lets a drop target read the dragged data when the
 * drop happens, so during the drag nobody knows what is being dragged. The
 * dragged thing registers itself here, and drop zones can then
 *   - light up while ANY class is being dragged,
 *   - highlight exactly as many periods as the class needs (a 3-period lab
 *     lights 3 cells), in red when it would not fit in the day,
 * and the page can scroll by itself when you drag to the top / bottom edge.
 */

let payload = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

export function beginDrag(next) {
  payload = next || { kind: "unknown" };

  // notify AFTER the browser has taken the drag image: re-rendering the
  // dragged element inside dragstart can cancel the drag in some browsers
  setTimeout(notify, 0);
}

export function endDrag() {
  if (payload === null) return;

  payload = null;
  notify();
}

export const currentDrag = () => payload;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// the dragged payload (null when nothing is being dragged)
export function useDragPayload() {
  return useSyncExternalStore(subscribe, () => payload, () => null);
}

// a drop or a cancelled drag always ends the drag
if (typeof window !== "undefined") {
  window.addEventListener("dragend", endDrag, true);
  window.addEventListener("drop", () => setTimeout(endDrag, 0), true);
}

/* ---------------------------------------------------------------
   Which cells to light up for the dragged class?
   hoveredIndex = the period under the pointer, total = periods in the day.
   Returns { from, to, bad } — bad when it would run past the last period.
   --------------------------------------------------------------- */
export function spanFor(drag, hoveredIndex, total) {
  const length = Math.max(1, Number(drag?.duration) || 1);
  const to = hoveredIndex + length - 1;

  return {
    from: hoveredIndex,
    to: Math.min(to, total - 1),
    bad: to > total - 1,
  };
}

/* ---------------------------------------------------------------
   Auto-scroll
   speed (px per frame): negative near the top of the box, positive near the
   bottom, faster the closer you get to the edge, 0 in the middle.
   --------------------------------------------------------------- */
export function edgeSpeed(pos, start, end, edge = 70, max = 26) {
  const fromStart = pos - start;
  const fromEnd = end - pos;

  if (fromStart < edge) {
    return -Math.round(max * (1 - Math.max(fromStart, 0) / edge));
  }

  if (fromEnd < edge) {
    return Math.round(max * (1 - Math.max(fromEnd, 0) / edge));
  }

  return 0;
}

function canScroll(node, speed) {
  return speed < 0
    ? node.scrollTop > 0
    : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
}

/*
 * While a class is being dragged, scroll whatever is under the pointer when
 * you move near its top / bottom edge: first the inner scroll area (the
 * timetable feed, a side panel), otherwise the whole page. Call it once in
 * the page component.
 */
export function useDragAutoScroll() {
  const dragging = Boolean(useDragPayload());

  useEffect(() => {
    if (!dragging) return undefined;

    let x = -1;
    let y = -1;
    let frame = 0;
    let running = true;

    const onOver = (event) => {
      x = event.clientX;
      y = event.clientY;
    };

    document.addEventListener("dragover", onOver, true);

    const tick = () => {
      if (!running) return;

      if (y >= 0) {
        let scrolled = false;
        let node = document.elementFromPoint(x, y);

        // 1) the innermost scrollable box the pointer is in, near ITS edge
        while (node && node !== document.body && node !== document.documentElement) {
          const style = getComputedStyle(node);

          if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
            const rect = node.getBoundingClientRect();
            const speed = rect.height > 160 ? edgeSpeed(y, rect.top, rect.bottom) : 0;

            if (speed && canScroll(node, speed)) {
              node.scrollTop += speed;
              scrolled = true;
              break;
            }
          }

          node = node.parentElement;
        }

        // 2) otherwise the page, near the top / bottom of the window
        if (!scrolled) {
          const speed = edgeSpeed(y, 0, window.innerHeight);

          if (speed) window.scrollBy(0, speed);
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("dragover", onOver, true);
    };
  }, [dragging]);
}
