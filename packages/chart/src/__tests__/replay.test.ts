import type { NormalizedCandle } from "trendcraft";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clampedSeedEnd, createLiveSimulator, SEED_RATIO_MAX, SEED_RATIO_MIN } from "../replay";

function makeCandles(n: number): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: 1700000000000 + i * 60_000,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 10 + i,
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createLiveSimulator", () => {
  it("loads the seed slice into completedCandles before playback", () => {
    const candles = makeCandles(10);
    const sim = createLiveSimulator({ candles, seedRatio: 0.6 });
    // 60% of 10 = 6 seed candles.
    expect(sim.seedCandles).toHaveLength(6);
    expect(sim.live.completedCandles).toHaveLength(6);
    expect(sim.getState()).toBe("idle");
    sim.dispose();
  });

  it("transitions through `playing` and `complete` states on the timer", () => {
    vi.useFakeTimers();
    const candles = makeCandles(5);
    // seedRatio 0.4 → 2 seed, 3 queued. ticksPerCandle 1 keeps the math
    // simple: each tick is a full candleComplete.
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.4,
      ticksPerCandle: 1,
      intervalMs: 100,
    });
    const states: string[] = [];
    sim.onChange((s) => states.push(s));
    sim.play();
    // Initial play → notify with "playing".
    expect(sim.getState()).toBe("playing");
    expect(sim.live.completedCandles).toHaveLength(2);
    // Advance through all 3 queued candles.
    vi.advanceTimersByTime(100);
    expect(sim.live.completedCandles).toHaveLength(3);
    vi.advanceTimersByTime(100);
    expect(sim.live.completedCandles).toHaveLength(4);
    vi.advanceTimersByTime(100);
    // After the LAST candle is emitted, state flips to complete on the
    // *same* tick — not lagging into the next interval.
    expect(sim.live.completedCandles).toHaveLength(5);
    expect(sim.getState()).toBe("complete");
    expect(states.includes("complete")).toBe(true);
    sim.dispose();
  });

  it("emits `ticksPerCandle` partials before each candleComplete", () => {
    vi.useFakeTimers();
    const candles = makeCandles(4);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.5,
      ticksPerCandle: 4,
      intervalMs: 50,
    });
    sim.play();
    expect(sim.live.completedCandles).toHaveLength(2);
    // 3 partials don't add to completedCandles.
    vi.advanceTimersByTime(150);
    expect(sim.live.completedCandles).toHaveLength(2);
    // 4th tick = candleComplete.
    vi.advanceTimersByTime(50);
    expect(sim.live.completedCandles).toHaveLength(3);
    sim.dispose();
  });

  it("`stepOnce({ wholeBar: true })` advances exactly one candleComplete", () => {
    const candles = makeCandles(5);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.4,
      ticksPerCandle: 5,
    });
    expect(sim.live.completedCandles).toHaveLength(2);
    sim.stepOnce(); // default wholeBar: true
    expect(sim.live.completedCandles).toHaveLength(3);
    expect(sim.getState()).toBe("idle");
    sim.dispose();
  });

  it("`stepOnce({ wholeBar: false })` advances one tick (partial or complete)", () => {
    const candles = makeCandles(4);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.5,
      ticksPerCandle: 3,
    });
    expect(sim.live.completedCandles).toHaveLength(2);
    sim.stepOnce({ wholeBar: false }); // partial 1/3 → no completion
    expect(sim.live.completedCandles).toHaveLength(2);
    sim.stepOnce({ wholeBar: false }); // partial 2/3
    expect(sim.live.completedCandles).toHaveLength(2);
    sim.stepOnce({ wholeBar: false }); // 3rd tick = candleComplete
    expect(sim.live.completedCandles).toHaveLength(3);
    sim.dispose();
  });

  it("pauses an active playback and stops the timer", () => {
    vi.useFakeTimers();
    const candles = makeCandles(6);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.5,
      ticksPerCandle: 1,
      intervalMs: 100,
    });
    sim.play();
    vi.advanceTimersByTime(100);
    expect(sim.live.completedCandles).toHaveLength(4);
    sim.pause();
    expect(sim.getState()).toBe("paused");
    vi.advanceTimersByTime(1000);
    // No additional ticks while paused.
    expect(sim.live.completedCandles).toHaveLength(4);
    sim.dispose();
  });

  it("`reset()` rewinds to seed-only and replaces the LiveCandle", () => {
    const candles = makeCandles(5);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.4,
      ticksPerCandle: 1,
    });
    sim.stepOnce();
    sim.stepOnce();
    expect(sim.live.completedCandles).toHaveLength(4);
    sim.reset();
    expect(sim.live.completedCandles).toHaveLength(2);
    expect(sim.getState()).toBe("idle");
    sim.dispose();
  });

  it("emits `complete` immediately when there are no queued candles", () => {
    // seedRatio 0.95 with 5 candles → seed = 4 (floor of 4.75), queue 1.
    // Use seedRatio=1 by clamping; with 1 candle and seedRatio=1 → clamp 0.95.
    const candles = makeCandles(2);
    // seedRatio is clamped to [0.05, 0.95], so for 2 candles seed = 1, queue 1.
    // Force "complete on init" via an empty post-seed slice: pass seedRatio
    // high enough that seedEnd === candles.length. seedRatio=0.95 with 2
    // candles → seedEnd = floor(1.9) = 1 → queue 1 (still has 1). Use
    // a single-candle input with seedRatio=0.95 → seedEnd = max(1, 0) = 1,
    // queue 0.
    const single = makeCandles(1);
    const sim = createLiveSimulator({ candles: single, seedRatio: 0.95 });
    expect(sim.getState()).toBe("complete");
    expect(sim.getProgress()).toBe(1);
    expect(candles.length).toBe(2); // sanity
    sim.dispose();
  });

  it("flips state to `complete` when stepOnce consumes the last bar (regression)", () => {
    // Without the eager check, state stays "idle"/"paused" until the
    // user steps once more — completion-driven UI would lag a frame.
    const candles = makeCandles(3);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.4,
      ticksPerCandle: 1,
    });
    expect(sim.live.completedCandles).toHaveLength(1); // floor(3 * 0.4) = 1
    sim.stepOnce(); // consumes 1st queued
    expect(sim.getState()).not.toBe("complete");
    sim.stepOnce(); // consumes the LAST queued bar
    expect(sim.getState()).toBe("complete");
    expect(sim.getProgress()).toBe(1);
    sim.dispose();
  });

  it("flips to `complete` for partial-tick stepOnce on the last bar too", () => {
    const candles = makeCandles(2);
    // 1 seed, 1 queued, 1 tick per candle → first stepOnce({wholeBar:false})
    // is the only tick (and it's a candleComplete since ticksPerCandle=1).
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.5,
      ticksPerCandle: 1,
    });
    sim.stepOnce({ wholeBar: false });
    expect(sim.getState()).toBe("complete");
    sim.dispose();
  });

  it("reports 0..1 progress across the queued candles", () => {
    const candles = makeCandles(5);
    const sim = createLiveSimulator({
      candles,
      seedRatio: 0.4,
      ticksPerCandle: 1,
    });
    expect(sim.getProgress()).toBe(0);
    sim.stepOnce();
    expect(sim.getProgress()).toBeCloseTo(1 / 3, 5);
    sim.stepOnce();
    expect(sim.getProgress()).toBeCloseTo(2 / 3, 5);
    sim.stepOnce();
    expect(sim.getProgress()).toBe(1);
    sim.dispose();
  });
});

describe("clampedSeedEnd", () => {
  const C = makeCandles(100);

  it("keeps the click within 5%/95% of the dataset", () => {
    expect(clampedSeedEnd(C, 1)).toBe(5); // floor(100 * 0.05)
    expect(clampedSeedEnd(C, 50)).toBe(50);
    expect(clampedSeedEnd(C, 99)).toBe(95); // floor(100 * 0.95)
    expect(clampedSeedEnd(C, 1000)).toBe(95);
  });

  it("guarantees at least one seed bar even on tiny datasets", () => {
    expect(clampedSeedEnd(makeCandles(1), 0)).toBeGreaterThanOrEqual(1);
    expect(clampedSeedEnd(makeCandles(5), 0)).toBeGreaterThanOrEqual(1);
  });

  it("matches SEED_RATIO_MIN / SEED_RATIO_MAX exposed for hosts that surface the bounds", () => {
    expect(SEED_RATIO_MIN).toBe(0.05);
    expect(SEED_RATIO_MAX).toBe(0.95);
  });

  it("floors fractional cursor input so the preview matches the simulator exactly", () => {
    // The helper exists to PREVIEW what `createLiveSimulator` will pick.
    // For the preview to be accurate, the helper must use the same
    // floor+clamp as the simulator — a fractional cursor (e.g. a
    // sub-pixel UI coordinate) must produce the same integer in both
    // places.
    const C100 = makeCandles(100);
    expect(clampedSeedEnd(C100, 10.9)).toBe(10);
    expect(clampedSeedEnd(C100, 10.1)).toBe(10);
    expect(clampedSeedEnd(C100, 50.5)).toBe(50);
    // And the round-trip: preview === simulator's actual seed.
    for (const cursor of [10.9, 10.1, 50.5, 4.99, 95.001]) {
      const sim = createLiveSimulator({ candles: C100, seedEnd: cursor });
      expect(sim.seedCandles.length).toBe(clampedSeedEnd(C100, cursor));
      sim.dispose();
    }
  });

  it("falls back to 60% default for NaN / undefined / non-numeric (no silent NaN propagation)", () => {
    // UI math (e.g. `0 / 0` from missing event coords) can produce NaN.
    // Without the guard, the helper returned NaN, the simulator did
    // `candles.slice(0, NaN) === []`, and the entire replay silently
    // stalled in the "complete" state.
    const C100 = makeCandles(100);
    const fallback = Math.floor(100 * 0.6); // 60
    expect(clampedSeedEnd(C100, Number.NaN)).toBe(fallback);
    expect(clampedSeedEnd(C100, undefined as unknown as number)).toBe(fallback);
    expect(clampedSeedEnd(C100, "abc" as unknown as number)).toBe(fallback);
    expect(clampedSeedEnd(C100, {} as unknown as number)).toBe(fallback);
    // And the simulator's actual seed matches the preview.
    for (const v of [Number.NaN, undefined, "abc", {}] as unknown[]) {
      const sim = createLiveSimulator({ candles: C100, seedEnd: v as number });
      expect(sim.seedCandles.length).toBe(fallback);
      sim.dispose();
    }
  });

  it("clamps ±Infinity to the max/min bounds (no NaN propagation)", () => {
    const C100 = makeCandles(100);
    expect(clampedSeedEnd(C100, Number.POSITIVE_INFINITY)).toBe(95);
    expect(clampedSeedEnd(C100, Number.NEGATIVE_INFINITY)).toBe(5);
  });

  it("returns 0 for empty candle arrays (matching the simulator's seed count)", () => {
    // Empty dataset: simulator can only seed 0 bars. Preview MUST agree.
    expect(clampedSeedEnd([], 0)).toBe(0);
    expect(clampedSeedEnd([], 50)).toBe(0);
    expect(clampedSeedEnd([], Number.NaN)).toBe(0);
  });

  it("PROPERTY: clampedSeedEnd(C, x) === createLiveSimulator({ candles: C, seedEnd: x }).seedCandles.length for every shape × cursor", () => {
    // The canonical preview/library equality. If this property ever
    // fails, the API has a drift bug — by construction. The test runs
    // across degenerate shapes (empty, length-1) and pathological
    // cursors (NaN, ±Infinity, non-numeric coerced) so the bug class
    // can't return through a corner case.
    const shapes = [0, 1, 2, 3, 5, 7, 22, 100, 333];
    const cursors: unknown[] = [
      Number.NaN,
      undefined,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -100,
      -1,
      0,
      0.9,
      1,
      4.999,
      5,
      15,
      15.5,
      50,
      94.5,
      95,
      99,
      999,
    ];
    for (const len of shapes) {
      const C = makeCandles(len);
      for (const cursor of cursors) {
        const preview = clampedSeedEnd(C, cursor as number);
        const sim = createLiveSimulator({ candles: C, seedEnd: cursor as number });
        expect(sim.seedCandles.length).toBe(preview);
        sim.dispose();
      }
    }
  });
});

describe("empty candles (degenerate input handled gracefully)", () => {
  it("simulator on empty candles seeds 0 bars and is immediately complete", () => {
    const sim = createLiveSimulator({ candles: [] });
    expect(sim.seedCandles.length).toBe(0);
    expect(sim.getEmittedQueueCount()).toBe(0);
    expect(sim.getState()).toBe("complete");
    sim.dispose();
  });

  it("getLastEmittedIdx returns -1 sentinel on empty candles (snapshot slice is empty)", () => {
    const sim = createLiveSimulator({ candles: [] });
    expect(sim.getLastEmittedIdx()).toBe(-1);
    // Host slicing `candles.slice(0, idx + 1)` gets the correct empty
    // snapshot instead of a phantom `candles[0]`.
    expect([].slice(0, sim.getLastEmittedIdx() + 1)).toEqual([]);
    sim.dispose();
  });
});

describe("getLastEmittedIdx (simulator-owned playhead, no drift)", () => {
  const C = makeCandles(100);

  it("idle (queue not started) points at the last seed bar, not the first unseen one", () => {
    // The off-by-one is the no-look-ahead invariant: at idle the cursor
    // must point at the last *seen* bar (= last seed bar), not the next
    // unseen one. seedEnd=40 + nextIdx=0 - 1 = 39.
    const sim = createLiveSimulator({ candles: C, seedEnd: 40 });
    expect(sim.getLastEmittedIdx()).toBe(39);
    sim.dispose();
  });

  it("matches seedCandles.length - 1 at idle for any seedEnd", () => {
    for (const seedEnd of [10, 25, 50, 75, 95]) {
      const sim = createLiveSimulator({ candles: C, seedEnd });
      expect(sim.getLastEmittedIdx()).toBe(sim.seedCandles.length - 1);
      sim.dispose();
    }
  });

  it("advances by exactly one per stepOnce", () => {
    const sim = createLiveSimulator({ candles: C, seedEnd: 40 });
    let prev = sim.getLastEmittedIdx();
    for (let i = 0; i < 10; i++) {
      sim.stepOnce();
      const next = sim.getLastEmittedIdx();
      expect(next - prev).toBe(1);
      prev = next;
    }
    sim.dispose();
  });

  it("at completion equals the last index in the dataset", () => {
    const sim = createLiveSimulator({ candles: C, seedEnd: 95 });
    // Queue length is 5; step through all of it.
    for (let i = 0; i < 10; i++) sim.stepOnce();
    expect(sim.getState()).toBe("complete");
    expect(sim.getLastEmittedIdx()).toBe(C.length - 1);
    sim.dispose();
  });

  it("pairs with seedCandles for a host snapshot slice", () => {
    const sim = createLiveSimulator({ candles: C, seedEnd: 40 });
    // Idle: snapshot of every emitted bar = exactly the seed.
    expect(C.slice(0, sim.getLastEmittedIdx() + 1)).toEqual(sim.seedCandles);
    sim.stepOnce();
    // After one step: snapshot grows by the just-emitted bar.
    expect(C.slice(0, sim.getLastEmittedIdx() + 1)).toEqual([...sim.seedCandles, C[40]]);
    sim.dispose();
  });
});

describe("drift-class regressions (locked in by simulator-owned integers)", () => {
  // Each test below targets a class of drift Codex caught during PR
  // review. They all collapse to "simulator-owned integers don't drift"
  // by construction now — there's no second derivation path.

  it("no float drift in seedRatio round-trip (22/15 case)", () => {
    // Host computes seedRatio = 15/22, simulator floor()s back. Older
    // code path produced seedEnd=14 not 15. The seedEnd integer option
    // (preferred) sidesteps this entirely.
    const C22 = makeCandles(22);
    const sim = createLiveSimulator({ candles: C22, seedEnd: 15 });
    expect(sim.seedCandles.length).toBe(15);
    expect(sim.getLastEmittedIdx()).toBe(14);
    sim.dispose();
  });

  it("no float drift in progress × queueLen for exact integer counts", () => {
    // After exactly 15 emits on a 22-bar queue, getProgress() = 15/22
    // which floats to 0.6818... and `floor(0.6818 * 22) === 14`. The
    // playhead is sourced from getLastEmittedIdx() (integer) so it
    // returns the correct seedEnd + 15 - 1 regardless.
    const C22 = makeCandles(22);
    const sim = createLiveSimulator({ candles: C22, seedEnd: 1 });
    expect(sim.seedCandles.length).toBe(clampedSeedEnd(C22, 1));
    const seedEnd = sim.seedCandles.length;
    const stepsToTake = Math.min(15, C22.length - seedEnd);
    for (let i = 0; i < stepsToTake; i++) sim.stepOnce();
    expect(sim.getEmittedQueueCount()).toBe(stepsToTake);
    expect(sim.getLastEmittedIdx()).toBe(seedEnd + stepsToTake - 1);
    sim.dispose();
  });

  it("no disagreement between simulator's actual seedEnd and clampedSeedEnd preview", () => {
    // Host previews the clamp via clampedSeedEnd, then creates the
    // simulator with the same anchor. The actual seed count must equal
    // the preview — no double-clamping mismatch.
    const C100 = makeCandles(100);
    for (const anchor of [0, 1, 4, 50, 96, 99, 200]) {
      const preview = clampedSeedEnd(C100, anchor);
      const sim = createLiveSimulator({ candles: C100, seedEnd: anchor });
      expect(sim.seedCandles.length).toBe(preview);
      sim.dispose();
    }
  });
});

describe("seedEnd option (integer anchor, no float drift)", () => {
  it("preserves the integer anchor when in-range — no roundoff from seedRatio path", () => {
    // The specific case `Math.floor(22 * (15/22)) === 14` (instead of 15)
    // would have happened if the host computed `seedRatio = anchor /
    // length` and passed that in. Passing seedEnd directly sidesteps the
    // multiply-back step entirely.
    const C22 = makeCandles(22);
    const sim = createLiveSimulator({ candles: C22, seedEnd: 15 });
    expect(sim.seedCandles.length).toBe(15);
    expect(sim.getLastEmittedIdx()).toBe(14);
    sim.dispose();
  });

  it("agrees with clampedSeedEnd for arbitrary (n, anchor) sweep", () => {
    // The simulator's actual `seedCandles.length` always equals what
    // `clampedSeedEnd(candles, anchor)` previews — they both funnel
    // through the same clamp.
    for (const n of [20, 22, 33, 47, 100, 333]) {
      const C = makeCandles(n);
      for (const anchor of [3, n >> 2, n >> 1, (n * 3) >> 2, n - 2]) {
        const sim = createLiveSimulator({ candles: C, seedEnd: anchor });
        expect(sim.seedCandles.length).toBe(clampedSeedEnd(C, anchor));
        sim.dispose();
      }
    }
  });

  it("clamps out-of-bounds seedEnd to SEED_RATIO_MIN/MAX bounds", () => {
    // The simulator's seedEnd path goes through clampedSeedEnd so any
    // out-of-range input lands within [5%, 95%]. Hosts can read the
    // actual value via `sim.seedCandles.length` if it matters.
    const C100 = makeCandles(100);
    expect(createLiveSimulator({ candles: C100, seedEnd: 0 }).seedCandles.length).toBe(5);
    expect(createLiveSimulator({ candles: C100, seedEnd: 1 }).seedCandles.length).toBe(5);
    expect(createLiveSimulator({ candles: C100, seedEnd: -5 }).seedCandles.length).toBe(5);
    expect(createLiveSimulator({ candles: C100, seedEnd: 99 }).seedCandles.length).toBe(95);
    expect(createLiveSimulator({ candles: C100, seedEnd: 999 }).seedCandles.length).toBe(95);
  });

  it("seedEnd takes precedence when both seedEnd and seedRatio are passed", () => {
    const C = makeCandles(100);
    const sim = createLiveSimulator({ candles: C, seedEnd: 30, seedRatio: 0.8 });
    expect(sim.seedCandles.length).toBe(30);
    sim.dispose();
  });
});
