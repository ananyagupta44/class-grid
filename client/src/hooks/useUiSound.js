"use client";
import { useEffect, useRef } from "react";

/**
 * ClassGrid UI sounds (all synthesised, no sound files):
 *   - SOFT BUBBLE while the user scrolls the page or the given element
 *   - POP when the user clicks a button / link / select / timetable area
 *
 * The scroll sound plays ONLY for scrolling done by the user (mouse wheel, touch drag,
 * scrollbar drag, arrow / page keys). Scrolling started by code, for example clicking a
 * course in the left rail which calls scrollTo(), makes NO scroll sound.
 *
 * Volume is FULL (1 = full scale), so how loud it is depends only on the device / system volume.
 * Browsers only allow sound after the user has clicked, tapped or pressed a key once.
 */

// one soft sine blip with a quick pitch glide
function blip(ctx, from, to, seconds, peak) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + seconds * 0.8);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

export const playBubble = (ctx, volume) => blip(ctx, 420, 1100, 0.09, volume); // scroll
export const playPop = (ctx, volume) => blip(ctx, 720, 260, 0.07, volume); // click

const CLICKABLE =
  "button, a[href], select, summary, [role='button'], [role='tab'], [data-sound]";
const TYPING =
  "button, input, select, textarea, [role='button'], [contenteditable='true']";
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * Framework-free core. Returns a function that removes every listener.
 *  element : scrollable element to listen to (the page itself is always listened to)
 *  clickOn : extra CSS selector that also plays the click sound, e.g. "[data-course-id]"
 */
export function attachUiSound({
  element,
  volume = 1,
  step = 80,
  clickOn = "",
  ctxRef = { current: null },
} = {}) {
  const clickables = clickOn ? `${CLICKABLE}, ${clickOn}` : CLICKABLE;

  const ensureCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctxRef.current ||= new AC();
    return ctxRef.current;
  };

  const unlock = () => {
    const ctx = ensureCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
  };

  // ---------- did the USER cause this scroll? ----------
  let userUntil = 0; // scroll events before this moment come from the user
  let touchMoved = false;
  let dragging = false; // dragging a scrollbar

  const markUser = (ms) => {
    userUntil = Math.max(userUntil, performance.now() + ms);
  };
  const fromUser = () => dragging || performance.now() < userUntil;

  const onWheel = () => markUser(200);
  const onTouchStart = () => {
    touchMoved = false;
  };
  const onTouchMove = () => {
    touchMoved = true;
    markUser(200);
  };
  // a flick keeps scrolling by momentum after the finger lifts; a plain tap does not count
  const onTouchEnd = () => {
    if (touchMoved) markUser(1000);
  };
  const onKey = (e) => {
    if (e.target.closest?.(TYPING)) return; // Space / Enter on a button is a click, not a scroll
    if (SCROLL_KEYS.has(e.key)) markUser(400);
  };
  const onPointerDown = (e) => {
    const inBar = (clientWidth, left) => e.clientX >= left + clientWidth;

    if (
      element &&
      e.target === element &&
      inBar(element.clientWidth, element.getBoundingClientRect().left)
    ) {
      dragging = true;
    } else if (
      e.target === document.documentElement &&
      inBar(document.documentElement.clientWidth, 0)
    ) {
      dragging = true;
    }
  };
  const onPointerUp = () => {
    dragging = false;
  };

  // ---------- scroll sound ----------
  let lastSoundAt = 0;

  const watch = (target, getY) => {
    let last = getY();

    const onScroll = () => {
      const y = getY();

      if (!fromUser()) {
        last = y; // scrolled by code: remember where we are, stay silent
        return;
      }

      if (Math.abs(y - last) < step) return;
      last = y;

      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;

      const now = performance.now(); // never faster than ~20 sounds a second
      if (now - lastSoundAt < 45) return;
      lastSoundAt = now;

      playBubble(ctx, volume);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  };

  const stops = [watch(window, () => window.scrollY)];
  if (element) stops.push(watch(element, () => element.scrollTop));

  // ---------- click sound ----------
  const onClick = (e) => {
    const hit = e.target.closest?.(clickables);

    if (
      !hit ||
      hit.disabled ||
      hit.getAttribute("aria-disabled") === "true" ||
      hit.closest("[data-no-sound]")
    )
      return;

    const ctx = ensureCtx();
    if (!ctx) return;

    if (ctx.state === "running") playPop(ctx, volume);
    else
      ctx
        .resume()
        .then(() => playPop(ctx, volume))
        .catch(() => {});
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKey);
  document.addEventListener("click", onClick);

  return () => {
    stops.forEach((stop) => stop());
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onClick);
  };
}

/**
 *  element : the scrolling element (pass the element itself, e.g. from useState)
 *  muted   : true switches every sound off (optional, there is no on/off button)
 *  clickOn : extra selector that plays the click sound
 */
export default function useUiSound({
  element,
  muted = false,
  volume,
  step,
  clickOn,
} = {}) {
  const ctxRef = useRef(null);

  useEffect(() => {
    if (muted) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;

    return attachUiSound({ element, volume, step, clickOn, ctxRef });
  }, [element, muted, volume, step, clickOn]);
}
