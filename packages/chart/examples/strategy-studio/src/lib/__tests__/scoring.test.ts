import { getPreset, type ScoringPreset } from "trendcraft";
import { describe, expect, it } from "vitest";
import type { StudioCandle } from "../sample-data";
import { runScoring, SCORING_PRESETS } from "../scoring";

function makeCandles(n: number): StudioCandle[] {
  return Array.from({ length: n }, (_, i) => {
    // Mild zig-zag so signals (RSI, momentum, etc.) actually fire.
    const t = 1700000000000 + i * 86400000;
    const drift = i * 0.5;
    const wave = Math.sin(i / 8) * 4;
    const close = 100 + drift + wave;
    return {
      time: t,
      open: close - 0.3,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + (i % 7) * 80,
    };
  });
}

const ALL_PRESETS: ScoringPreset[] = SCORING_PRESETS.map((p) => p.id);

describe("runScoring (PR11 invariants)", () => {
  it("returns kind:'empty' for too-short candle slices", () => {
    const out = runScoring(makeCandles(1), "momentum");
    expect(out.kind).toBe("empty");
  });

  it("returns kind:'empty' for an empty array", () => {
    const out = runScoring([], "balanced");
    expect(out.kind).toBe("empty");
  });

  it.each(ALL_PRESETS)("each preset (%s) produces an ok result on a non-trivial slice", (p) => {
    const out = runScoring(makeCandles(120), p);
    if (out.kind !== "ok") throw new Error(`expected ok for ${p}, got ${out.kind}`);
    expect(out.series.length).toBe(120);
    expect(out.breakdown.contributions.length).toBeGreaterThan(0);
  });

  it("normalizedScore stays in [0, 100] for every preset across a full series", () => {
    const candles = makeCandles(300);
    for (const preset of ALL_PRESETS) {
      const out = runScoring(candles, preset);
      if (out.kind !== "ok") throw new Error(`expected ok for ${preset}`);
      for (const point of out.series) {
        expect(point.score.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(point.score.normalizedScore).toBeLessThanOrEqual(100);
      }
      expect(out.breakdown.normalizedScore).toBeGreaterThanOrEqual(0);
      expect(out.breakdown.normalizedScore).toBeLessThanOrEqual(100);
    }
  });

  it("strength tier is consistent with normalizedScore + the preset's own thresholds", () => {
    // Different presets ship different thresholds (momentum 70/50/30,
    // meanReversion 75/55/35, aggressive 60/40/25, conservative 80/60/40).
    // The invariant we want is "strength agrees with the *preset's* config",
    // not "strength agrees with a hardcoded 70/50/30".
    const candles = makeCandles(300);
    for (const preset of ALL_PRESETS) {
      const out = runScoring(candles, preset);
      if (out.kind !== "ok") throw new Error(`expected ok for ${preset}`);
      const config = getPreset(preset);
      const strong = config.strongThreshold ?? 70;
      const moderate = config.moderateThreshold ?? 50;
      const weak = config.weakThreshold ?? 30;
      const { normalizedScore, strength } = out.breakdown;
      const expected =
        normalizedScore >= strong
          ? "strong"
          : normalizedScore >= moderate
            ? "moderate"
            : normalizedScore >= weak
              ? "weak"
              : "none";
      expect(strength).toBe(expected);
    }
  });

  it("is deterministic — identical inputs produce identical outputs", () => {
    const candles = makeCandles(80);
    const a = runScoring(candles, "balanced");
    const b = runScoring(candles, "balanced");
    expect(a).toEqual(b);
  });

  it("breakdown contributions sum to rawScore (within fp tolerance)", () => {
    const out = runScoring(makeCandles(200), "trendFollowing");
    if (out.kind !== "ok") throw new Error("expected ok");
    const sum = out.breakdown.contributions.reduce((s, c) => s + c.score, 0);
    expect(sum).toBeCloseTo(out.breakdown.rawScore, 6);
  });

  it("activeSignals never exceeds totalSignals", () => {
    const candles = makeCandles(150);
    for (const preset of ALL_PRESETS) {
      const out = runScoring(candles, preset);
      if (out.kind !== "ok") throw new Error("expected ok");
      for (const point of out.series) {
        expect(point.score.activeSignals).toBeLessThanOrEqual(point.score.totalSignals);
      }
    }
  });
});
