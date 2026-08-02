/**
 * Randomized viewport invariant fuzz — fixed seeds, CI-resident.
 *
 * Drives TimeScale through long random sequences of every mutating
 * operation and asserts structural invariants after each. Complements the
 * example-based tests: any state the operations can reach must be finite,
 * renderable, and recoverable, and the clamp envelope must always contain
 * the resting position after a settle.
 *
 * On failure the seed and a trailing window of the op log are printed —
 * paste the seed into `SEEDS` to reproduce deterministically.
 */

import { describe, expect, it } from "vitest";
import { TimeScale } from "../core/scale";

const SEEDS = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
const OPS_PER_SEED = 4000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Op = { name: string; run: (ts: TimeScale, rnd: () => number) => void };

const OPS: Op[] = [
  { name: "setWidth", run: (ts, r) => ts.setWidth([0, 1, 333.7, 800, 1600][(r() * 5) | 0]) },
  {
    name: "setTotalCount",
    run: (ts, r) => ts.setTotalCount([0, 1, 50, 300, 5000][(r() * 5) | 0]),
  },
  {
    name: "gaps",
    run: (ts, r) => {
      const n = ts.totalCount;
      if (n < 3) return;
      ts.setGapsBefore([
        { index: (r() * n) | 0, size: r() * 25 },
        { index: (r() * n) | 0, size: r() * 2 },
      ]);
    },
  },
  { name: "clearGaps", run: (ts) => ts.clearGaps() },
  { name: "scrollBy", run: (ts, r) => ts.scrollBy((r() - 0.5) * 200) },
  { name: "scrollTo", run: (ts, r) => ts.scrollTo((r() - 0.3) * ts.totalCount * 1.5) },
  { name: "scrollByUnclamped", run: (ts, r) => ts.scrollByUnclamped((r() - 0.5) * 100) },
  { name: "zoom", run: (ts, r) => ts.zoom(0.1 + r() * 4, r() * 1000 - 100) },
  { name: "zoomNaN", run: (ts) => ts.zoom(Number.NaN, Number.NaN) },
  { name: "scrollToEnd", run: (ts) => ts.scrollToEnd() },
  { name: "fitContent", run: (ts) => ts.fitContent() },
  {
    name: "rightOffset",
    run: (ts, r) => ts.setRightOffset([0, 2.5, 30, 1e5, Number.NaN, -5][(r() * 6) | 0]),
  },
  {
    name: "setVisibleRange",
    run: (ts, r) => {
      const a = (r() - 0.2) * ts.totalCount;
      ts.setVisibleRange(a, a + r() * ts.totalCount);
    },
  },
  {
    name: "setVisibleLogicalRange",
    run: (ts, r) => {
      const from = (r() - 0.5) * ts.totalCount * 2;
      ts.setVisibleLogicalRange(from, from + r() * r() * 3000 + 0.01);
    },
  },
  {
    name: "followAfterAppend",
    run: (ts) => {
      const dist = ts.endDistanceVirtual;
      ts.setTotalCount(ts.totalCount + 1);
      ts.followLiveEdge(dist);
    },
  },
  { name: "ratify", run: (ts) => ts.ratifySettledPosition() },
  {
    name: "setImmediate",
    run: (ts, r) => ts.setImmediate((r() - 0.5) * ts.totalCount * 2, 0.05 + r() * 900),
  },
];

function checkInvariants(ts: TimeScale, log: string[], seed: number): void {
  const fail = (what: string): never => {
    throw new Error(
      `invariant violated: ${what} (seed=0x${seed.toString(16)})\nlast ops: ${log.slice(-12).join(" → ")}\nstate: start=${ts.rawStartIndex} spacing=${ts.barSpacing} visible=${ts.visibleCount} total=${ts.totalCount} width=${ts.width}`,
    );
  };
  if (!Number.isFinite(ts.rawStartIndex)) fail("rawStartIndex not finite");
  if (!Number.isFinite(ts.barSpacing) || ts.barSpacing < 0.05) fail("barSpacing bad");
  if (!Number.isInteger(ts.visibleCount) || ts.visibleCount < 0) fail("visibleCount bad");
  if (!Number.isFinite(ts.endIndex) || ts.endIndex > ts.totalCount) fail("endIndex bad");
  const lr = ts.getVisibleLogicalRange();
  if (ts.width > 0 && !(Number.isFinite(lr.from) && Number.isFinite(lr.to) && lr.to > lr.from)) {
    fail("logical range bad");
  }
  if (!Number.isFinite(ts.indexToX(0)) || !Number.isFinite(ts.xToIndex(0))) {
    fail("coordinate transform not finite");
  }
}

describe("viewport invariant fuzz (fixed seeds)", () => {
  for (const seed of SEEDS) {
    it(`seed 0x${seed.toString(16)}: ${OPS_PER_SEED} ops hold all invariants`, () => {
      const rnd = mulberry32(seed);
      const ts = new TimeScale();
      ts.setWidth(800);
      ts.setTotalCount(300);
      const log: string[] = [];

      for (let i = 0; i < OPS_PER_SEED; i++) {
        const op = OPS[(rnd() * OPS.length) | 0];
        log.push(op.name);
        op.run(ts, rnd);
        checkInvariants(ts, log, seed);
      }

      // Envelope invariants at settle: after ratify the resting position is
      // inside the envelope, and clamped ops can no longer move away from it
      // unexpectedly (recoverability).
      ts.ratifySettledPosition();
      const rest = ts.rawStartIndex;
      ts.scrollBy(0); // clamp round-trip
      expect(ts.rawStartIndex).toBeCloseTo(rest, 9);

      // Recoverability: explicit navigation always lands in ordinary bounds
      // and releases any grant.
      ts.scrollToEnd();
      expect(ts.hasViewportGrant).toBe(false);
      expect(Number.isFinite(ts.rawStartIndex)).toBe(true);
      ts.scrollBy(1);
      ts.scrollBy(-1);
      expect(Number.isFinite(ts.rawStartIndex)).toBe(true);
    });
  }
});
