/**
 * Contract tests for the volume signal evaluators, driven through the real
 * indicator path (no hand-built precomputed objects).
 *
 * Two regressions are pinned here:
 * - the bullish volume-trend evaluator must not pay out on a rally with
 *   collapsing volume (that state is the bearish divergence, and the bearish
 *   evaluator already scores it)
 * - the CMF evaluators must ramp 0.5 → 1 between the threshold and twice the
 *   threshold, continuous with the 0 → 0.5 ramp below the threshold
 */

import { describe, expect, it } from "vitest";
import { cmf, volumeTrend } from "../../indicators";
import type { NormalizedCandle } from "../../types";
import {
  createBearishVolumeTrendEvaluator,
  createBullishVolumeTrendEvaluator,
  createCmfNegativeEvaluator,
  createCmfPositiveEvaluator,
} from "../signals/volume";

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);

/** Price +2%/bar throughout; volume 5000 for the first half, then 100 (rally on collapsing volume). */
function rallyOnCollapsingVolume(count = 40): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let close = 100;
  for (let i = 0; i < count; i++) {
    const open = close;
    close = open * 1.02;
    candles.push({
      time: T0 + i * DAY,
      open,
      high: close * 1.001,
      low: open * 0.999,
      close,
      volume: i < count / 2 ? 5000 : 100,
    });
  }
  return candles;
}

/**
 * Candles whose CMF equals `multiplier` bit-exactly for the values used below:
 * high=105, low=95, volume=10, close=100+5·multiplier, so the money-flow
 * multiplier (2·close − high − low)/(high − low) is (10·multiplier)/10 and the
 * volume-weighted average over the window is (20·10·multiplier)/200. Both
 * divisions round back to the literal, which matters at the threshold: with a
 * value 1 ulp below 0.1 the evaluator takes the below-threshold branch and the
 * threshold case would pass on the buggy formula as well.
 */
function constantCmfCandles(multiplier: number, count = 25): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      time: T0 + i * DAY,
      open: 100,
      high: 105,
      low: 95,
      close: 100 + 5 * multiplier,
      volume: 10,
    });
  }
  return candles;
}

describe("bullish volume trend evaluator on a rally with collapsing volume", () => {
  const candles = rallyOnCollapsingVolume();
  const bullish = createBullishVolumeTrendEvaluator(20);
  const bearish = createBearishVolumeTrendEvaluator(20);
  const trend = volumeTrend(candles, { maPeriod: 20 });

  it("stimulus: the indicator reports a bearish divergence with confidence > 70 on some bars", () => {
    const divergent = trend
      .map((t, i) => ({ i, v: t.value }))
      .filter(
        ({ v }) =>
          v.priceTrend === "up" && v.volumeTrend === "down" && v.hasDivergence && v.confidence > 70,
      );
    expect(divergent.length).toBeGreaterThan(0);
    // the same bars must not be confirmed
    expect(divergent.every(({ v }) => !v.isConfirmed)).toBe(true);
  });

  it("scores 0 on every divergence bar, while the bearish evaluator scores confidence/100", () => {
    let bearishFired = 0;
    for (let i = 20; i < candles.length; i++) {
      const v = trend[i].value;
      if (!(v.priceTrend === "up" && v.volumeTrend === "down")) continue;
      expect(bullish(candles, i)).toBe(0);
      const bear = bearish(candles, i);
      expect(bear).toBeCloseTo(v.confidence / 100, 10);
      if (bear > 0) bearishFired++;
    }
    expect(bearishFired).toBeGreaterThan(0);
  });

  it("never scores the same bar on both the bullish and the bearish evaluator", () => {
    for (let i = 20; i < candles.length; i++) {
      const bull = bullish(candles, i);
      const bear = bearish(candles, i);
      expect(bull === 0 || bear === 0).toBe(true);
    }
  });
});

describe("CMF evaluators ramp continuously across the threshold", () => {
  // `branch` names the evaluator branch the case must reach; it is asserted on
  // the indicator output, not assumed from the literal.
  const cases: Array<{ cmfValue: number; expected: number; branch: "below" | "above" }> = [
    { cmfValue: 0.05, expected: 0.25, branch: "below" },
    { cmfValue: 0.0999, expected: 0.4995, branch: "below" },
    { cmfValue: 0.1, expected: 0.5, branch: "above" },
    { cmfValue: 0.11, expected: 0.55, branch: "above" },
    { cmfValue: 0.15, expected: 0.75, branch: "above" },
    { cmfValue: 0.2, expected: 1, branch: "above" },
    { cmfValue: 0.5, expected: 1, branch: "above" },
  ];

  it.each(cases)("positive side: CMF=$cmfValue → $expected (threshold 0.1, $branch)", ({
    cmfValue,
    expected,
    branch,
  }) => {
    const candles = constantCmfCandles(cmfValue);
    // stimulus: the indicator produced the value and it sits on the intended side of the threshold
    const series = cmf(candles, { period: 20 });
    const value = series[series.length - 1].value as number;
    expect(value).toBeCloseTo(cmfValue, 10);
    expect(value >= 0.1).toBe(branch === "above");
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    expect(evaluate(candles, candles.length - 1)).toBeCloseTo(expected, 10);
  });

  it.each(cases)("negative side: CMF=-$cmfValue → $expected (threshold -0.1, $branch)", ({
    cmfValue,
    expected,
    branch,
  }) => {
    const candles = constantCmfCandles(-cmfValue);
    const series = cmf(candles, { period: 20 });
    const value = series[series.length - 1].value as number;
    expect(value).toBeCloseTo(-cmfValue, 10);
    expect(value <= -0.1).toBe(branch === "above");
    const evaluate = createCmfNegativeEvaluator(-0.1, 20);
    expect(evaluate(candles, candles.length - 1)).toBeCloseTo(expected, 10);
  });

  it("is monotonic non-decreasing in |CMF| and continuous at the threshold (sampled 0 → 0.3)", () => {
    const positive = createCmfPositiveEvaluator(0.1, 20);
    const negative = createCmfNegativeEvaluator(-0.1, 20);
    let prevPos = 0;
    let prevNeg = 0;
    let steps = 0;
    let aboveThreshold = 0;
    for (let k = 0; k <= 300; k++) {
      const x = k / 1000;
      const up = constantCmfCandles(x);
      const down = constantCmfCandles(-x);
      const value = cmf(up, { period: 20 })[24].value as number;
      if (value >= 0.1) aboveThreshold++;
      const pos = positive(up, 24);
      const neg = negative(down, 24);
      expect(pos).toBeGreaterThanOrEqual(prevPos);
      expect(neg).toBeGreaterThanOrEqual(prevNeg);
      // the largest jump between consecutive samples is one ramp step, never the 0.5 cliff
      expect(pos - prevPos).toBeLessThan(0.01);
      expect(neg - prevNeg).toBeLessThan(0.01);
      expect(pos).toBeCloseTo(neg, 10);
      prevPos = pos;
      prevNeg = neg;
      steps++;
    }
    expect(steps).toBe(301);
    // the >= threshold branch was entered for x = 0.100 … 0.300 (201 samples), not skipped by rounding
    expect(aboveThreshold).toBe(201);
    expect(prevPos).toBe(1);
  });
});
