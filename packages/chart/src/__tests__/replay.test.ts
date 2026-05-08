import type { NormalizedCandle } from "trendcraft";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveSimulator } from "../replay";

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
