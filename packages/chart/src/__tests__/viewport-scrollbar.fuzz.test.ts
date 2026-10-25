// @vitest-environment happy-dom
/**
 * Randomized scrollbar fuzz through the DOM handlers — fixed seeds,
 * CI-resident (ops #17).
 *
 * viewport-invariants.fuzz drives TimeScale directly, so the scrollbar's
 * pointer paths (thumb grab → drag → release, track click) were never in a
 * random sequence: the thumb's far-right drag ate the rightOffset margin
 * (public PR #358) with no fuzz to catch it. Here the scrollbar gestures, by
 * mouse or touch, are interleaved with chart drags, wheel, keys, inertia
 * frames and data / layout changes, and after every step:
 * - the TimeScale state is finite and renderable (as in the core fuzz);
 * - a scrollbar press inside the thumb drawn by `scrollbarThumbRect` is a
 *   grab: it does not move the viewport;
 * - a scrollbar move or track click lands inside [0, scrollToEndTarget],
 *   holds no viewport grant, and reaches an end when the pointer asks past it;
 * - a drag on the chart pans by the pointer's travel while in bounds, so no
 *   scrollbar drag outlives its gesture.
 *
 * On failure the seed and a trailing window of the op log are printed —
 * paste the seed into `SEEDS` to reproduce deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import { scrollbarThumbRect } from "../core/scrollbar-geometry";
import type { PaneRect } from "../core/types";
import { type ScrollbarRect, Viewport } from "../core/viewport";
import { checkInvariants, fuzzFailure, mulberry32 } from "./helpers/fuzz";

const SEEDS = [0x2545f491, 0x9e3779b9, 0x6c8e9cf5];
const OPS_PER_SEED = 1500;
const EL_WIDTH = 800;
const EL_HEIGHT = 600;
const SB_Y = 580;
const SB_HEIGHT = 12;
const PANE_Y = 200;

type Harness = {
  el: HTMLElement;
  vp: Viewport;
  ts: TimeScale;
  sb: ScrollbarRect;
  rnd: () => number;
  log: string[];
  seed: number;
};

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: EL_WIDTH,
      bottom: EL_HEIGHT,
      width: EL_WIDTH,
      height: EL_HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  if (typeof el.focus !== "function") el.focus = () => undefined;
  return el;
}

function mouse(h: Harness, type: string, x: number, y: number): void {
  h.el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

/** One-finger touch event; `x` null lifts the finger (no touches left). */
function touch(h: Harness, type: string, x: number | null, y: number): void {
  const touches = x === null ? [] : [{ clientX: x, clientY: y, identifier: 0 } as unknown as Touch];
  // happy-dom may lack the TouchEvent constructor: fall back to a plain event.
  let ev: Event;
  try {
    ev = new TouchEvent(type, { bubbles: true, cancelable: true, touches });
  } catch {
    ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "touches", { value: touches });
  }
  h.el.dispatchEvent(ev);
}

/** Gestures run with the mouse or, about a third of the time, one finger. */
type Device = "mouse" | "touch";

function device(h: Harness): Device {
  return h.rnd() < 0.3 ? "touch" : "mouse";
}

function press(h: Harness, d: Device, x: number, y: number): void {
  if (d === "mouse") mouse(h, "mousedown", x, y);
  else touch(h, "touchstart", x, y);
}

function move(h: Harness, d: Device, x: number, y: number): void {
  if (d === "mouse") mouse(h, "mousemove", x, y);
  else touch(h, "touchmove", x, y);
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[(r() * xs.length) | 0];
}

/** A pointer x anywhere along the track, sometimes past either end. */
function trackX(h: Harness): number {
  return -40 + h.rnd() * (h.sb.width + 80);
}

/**
 * After a scrollbar move or track click: inside [0, scrollToEndTarget] with
 * no grant, and pinned to an end when the pointer asked to go past it.
 * `requested` is the start index the pointer asks for before any clamping,
 * in bars; the margins cover the handler's rounding to whole bars.
 */
function checkScrollbarLanding(h: Harness, requested: number): void {
  const { ts } = h;
  if (h.sb.width <= 0 || ts.totalCount <= 0) return;
  const fail = (what: string) => fuzzFailure(ts, h.log, h.seed, what);
  const end = Math.max(0, ts.scrollToEndTarget);
  if (ts.rawStartIndex < 0) fail("scrollbar landed before the first bar");
  if (ts.rawStartIndex > end + 1e-9) fail(`scrollbar landed past scrollToEndTarget (${end})`);
  if (ts.hasViewportGrant) fail("scrollbar left a viewport grant");
  // Past the far right is the End position, rightOffset margin included
  // (public PR #358 stopped short at `total - visible`).
  if (requested >= end + 1 && ts.rawStartIndex !== end) {
    fail(`scrollbar asked for ${requested} but stopped short of scrollToEndTarget (${end})`);
  }
  if (requested <= -2 && ts.rawStartIndex !== 0) {
    fail(`scrollbar asked for ${requested} but stopped short of the first bar`);
  }
}

/**
 * Release the pointer: a mouseup, or a mouseleave that interrupts the drag;
 * a touchend, or a touchcancel.
 */
function release(h: Harness, d: Device, x: number, y: number): void {
  const usual = h.rnd() < 0.8;
  if (d === "mouse") mouse(h, usual ? "mouseup" : "mouseleave", x, y);
  else touch(h, usual ? "touchend" : "touchcancel", null, y);
}

/** A wheel, key or frame step dropped into the middle of a scrollbar drag. */
function interleave(h: Harness): void {
  const op = pick(h.rnd, [wheel, key, frames]);
  h.log.push(`  ${op.name}`);
  op(h);
  checkInvariants(h.ts, h.log, h.seed);
}

function sbGrab(h: Harness): void {
  const thumb = scrollbarThumbRect(h.ts, h.sb.x, h.sb.width);
  if (!thumb) return;
  const d = device(h);
  const x0 = thumb.x + h.rnd() * thumb.width;
  const before = h.ts.rawStartIndex;
  press(h, d, x0, SB_Y + 2);
  if (h.ts.rawStartIndex !== before) {
    fuzzFailure(h.ts, h.log, h.seed, "pressing the drawn thumb moved the viewport");
  }
  // The grab keeps the pointer's offset into the thumb, as a fraction of
  // the track: the start follows the pointer minus that offset.
  const grab = (x0 - h.sb.x) / h.sb.width - thumb.startFrac;
  let x = x0;
  for (let i = (h.rnd() * 5) | 0; i > 0; i--) {
    if (h.rnd() < 0.2) interleave(h);
    x = trackX(h);
    move(h, d, x, SB_Y + 2);
    checkInvariants(h.ts, h.log, h.seed);
    checkScrollbarLanding(h, ((x - h.sb.x) / h.sb.width - grab) * h.ts.totalCount);
  }
  release(h, d, x, SB_Y + 2);
}

function sbTrack(h: Harness): void {
  const thumb = scrollbarThumbRect(h.ts, h.sb.x, h.sb.width);
  const d = device(h);
  // A press outside the thumb, left or right of it, but on the element: a
  // real pointer outside its box never reaches these listeners.
  let x = Math.min(EL_WIDTH, Math.max(0, trackX(h)));
  if (thumb) {
    const left = thumb.x - 1 - h.rnd() * 60;
    const right = thumb.x + thumb.width + 1 + h.rnd() * 60;
    const fits = [left, right].filter((v) => v >= 0 && v <= EL_WIDTH);
    if (!fits.length) return;
    x = pick(h.rnd, fits);
  }
  // A track press centres the window on the pointer.
  const centred = (px: number) =>
    ((px - h.sb.x) / h.sb.width) * h.ts.totalCount - h.ts.visibleCount / 2;
  press(h, d, x, SB_Y + 2);
  checkInvariants(h.ts, h.log, h.seed);
  checkScrollbarLanding(h, centred(x));
  if (h.rnd() < 0.4) {
    x = trackX(h);
    move(h, d, x, SB_Y + 2);
    checkInvariants(h.ts, h.log, h.seed);
    checkScrollbarLanding(h, centred(x));
  }
  release(h, d, x, SB_Y + 2);
}

/**
 * A drag on the chart pans by the pointer's travel while it stays in
 * bounds. A scrollbar drag left active by an earlier gesture would swallow
 * it instead (the touch release once did not end one).
 */
function chartDrag(h: Harness): void {
  const { ts } = h;
  const d = device(h);
  const x0 = h.rnd() * EL_WIDTH;
  const start = ts.rawStartIndex;
  let x = x0;
  // A second touch soon after a first is a double tap (fitContent), which
  // starts no pan: `isDragging` stays false and the check below is skipped.
  press(h, d, x0, PANE_Y);
  for (let i = 1 + ((h.rnd() * 4) | 0); i > 0; i--) {
    // Mostly short steps, which stay in bounds where the pan is checked.
    x += (h.rnd() - 0.5) * (h.rnd() < 0.8 ? 120 : 600);
    move(h, d, x, PANE_Y);
    checkInvariants(ts, h.log, h.seed);
    const panned = start - (x - x0) / ts.barSpacing;
    if (
      h.vp.state.isDragging &&
      ts.overscroll === 0 &&
      Math.abs(ts.rawStartIndex - panned) > 1e-6
    ) {
      fuzzFailure(ts, h.log, h.seed, `chart drag landed at ${ts.rawStartIndex}, not ${panned}`);
    }
  }
  release(h, d, x, PANE_Y);
}

function wheel(h: Harness): void {
  const r = h.rnd;
  h.el.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: r() * EL_WIDTH,
      clientY: PANE_Y,
      deltaX: r() < 0.5 ? (r() - 0.5) * 400 : 0,
      deltaY: (r() - 0.5) * 400,
      ctrlKey: r() < 0.3,
    }),
  );
}

function pressKey(el: HTMLElement, k: string): void {
  const code = k === "+" ? "Equal" : k === "-" ? "Minus" : k;
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, code, bubbles: true, cancelable: true }));
}

function key(h: Harness): void {
  pressKey(h.el, pick(h.rnd, ["Home", "End", "ArrowLeft", "ArrowRight", "+", "-"]));
}

/** Let inertia, bounce-back and wheel-session timers run. */
function frames(h: Harness): void {
  vi.advanceTimersByTime(16 * (1 + ((h.rnd() * 60) | 0)));
}

const OPS: ((h: Harness) => void)[] = [
  sbGrab,
  sbGrab,
  sbGrab,
  sbTrack,
  sbTrack,
  chartDrag,
  wheel,
  key,
  frames,
  function setTotalCount(h) {
    // Weighted to data that does not fit the width, where a pan stays in
    // bounds and the chart-drag check applies.
    h.ts.setTotalCount(pick(h.rnd, [0, 1, 50, 300, 2000, 5000, 5000]));
  },
  function appendBar(h) {
    h.ts.setTotalCount(h.ts.totalCount + 1);
  },
  function rightOffset(h) {
    h.ts.setRightOffset(pick(h.rnd, [0, 2.5, 7, 30, 1e5]));
  },
  function gaps(h) {
    const n = h.ts.totalCount;
    if (n < 3) return;
    h.ts.setGapsBefore([
      { index: (h.rnd() * n) | 0, size: h.rnd() * 25 },
      { index: (h.rnd() * n) | 0, size: h.rnd() * 2 },
    ]);
  },
  function clearGaps(h) {
    h.ts.clearGaps();
  },
  function setWidth(h) {
    // The scrollbar track spans the data area, as in canvas-chart.
    const w = pick(h.rnd, [0, 1, 333.7, 800]);
    h.ts.setWidth(w);
    h.sb.width = w;
  },
  function fitContent(h) {
    h.ts.fitContent();
  },
  function setVisibleLogicalRange(h) {
    // Can land outside the ordinary bounds and hold a grant.
    const from = (h.rnd() - 0.5) * h.ts.totalCount * 2;
    h.ts.setVisibleLogicalRange(from, from + h.rnd() * h.rnd() * 3000 + 0.01);
  },
];

describe("viewport scrollbar fuzz through the DOM (fixed seeds)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const seed of SEEDS) {
    it(`seed 0x${seed.toString(16)}: ${OPS_PER_SEED} ops hold all invariants`, () => {
      const ts = new TimeScale();
      ts.setWidth(EL_WIDTH);
      ts.setTotalCount(300);
      const sb: ScrollbarRect = { x: 0, y: SB_Y, width: EL_WIDTH, height: SB_HEIGHT };
      const panes: PaneRect[] = [
        { id: "main", x: 0, y: 0, width: EL_WIDTH, height: SB_Y, config: { id: "main", flex: 1 } },
      ];
      const el = makeEl();
      const vp = new Viewport();
      const detach = vp.attach(
        el,
        ts,
        () => panes,
        () => sb,
      );
      const h: Harness = { el, vp, ts, sb, rnd: mulberry32(seed), log: [], seed };

      try {
        for (let i = 0; i < OPS_PER_SEED; i++) {
          const op = pick(h.rnd, OPS);
          h.log.push(op.name);
          op(h);
          checkInvariants(ts, h.log, seed);
        }

        // Recoverability: once every gesture has settled, End lands where
        // scrollToEnd does and releases any grant.
        vi.advanceTimersByTime(5000);
        pressKey(el, "End");
        expect(ts.rawStartIndex).toBe(ts.scrollToEndTarget);
        expect(ts.hasViewportGrant).toBe(false);
      } finally {
        detach();
      }
    });
  }
});
