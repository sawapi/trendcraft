/**
 * Shared pieces of the fixed-seed viewport fuzz tests: a seeded PRNG and the
 * structural invariants every reachable TimeScale state must hold.
 */

import type { TimeScale } from "../../core/scale";

/** Seeded PRNG (mulberry32): the same seed replays the same op sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Throw with the seed, the last ops and the state when `what` is violated. */
export function fuzzFailure(ts: TimeScale, log: string[], seed: number, what: string): never {
  throw new Error(
    `invariant violated: ${what} (seed=0x${seed.toString(16)})\nlast ops: ${log.slice(-12).join(" → ")}\nstate: start=${ts.rawStartIndex} spacing=${ts.barSpacing} visible=${ts.visibleCount} total=${ts.totalCount} width=${ts.width}`,
  );
}

/** The state is finite, renderable and maps coordinates both ways. */
export function checkInvariants(ts: TimeScale, log: string[], seed: number): void {
  const fail = (what: string) => fuzzFailure(ts, log, seed, what);
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
