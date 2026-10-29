import { describe, expect, it } from "vitest";
import type { NormalizedCandle, ScoringConfig, SignalDefinition } from "../../types";
import { ScoreBuilder } from "../builder";
import { calculateScore, calculateScoreBreakdown, isScoreAbove, isScoreBelow } from "../calculator";
import {
  minActiveSignals,
  scoreAbove,
  scoreBelow,
  scoreIncreasing,
  scoreStrength,
  scoreWithMinSignals,
} from "../conditions";

const candles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
  time: Date.UTC(2024, 0, 1 + i),
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
}));

const signal = (weight: number, value = 1): SignalDefinition => ({
  name: `w${weight}`,
  displayName: `w${weight}`,
  weight,
  evaluate: () => value,
});

const configWith = (weight: number): ScoringConfig => ({
  signals: [signal(1), signal(weight)],
});

describe("signal weights", () => {
  it("used to let a negative weight flip a signal and NaN poison the score", () => {
    // Both are now rejected where the score is computed.
    expect(() => calculateScore(candles, 4, configWith(-1))).toThrow(/weight must be non-negative/);
    expect(() => calculateScore(candles, 4, configWith(Number.NaN))).toThrow(/finite/);
    expect(() => calculateScoreBreakdown(candles, 4, configWith(-1))).toThrow(/signals\[1\]/);
  });

  it("keeps a zero weight, which switches a signal off", () => {
    const result = calculateScore(candles, 4, {
      signals: [signal(1, 1), signal(0, 0)],
    });
    expect(result.normalizedScore).toBe(100);
  });

  it("rejects a bad weight at the ScoreBuilder call", () => {
    expect(() => ScoreBuilder.create().addRsiOversold(30, -2)).toThrow(/weight/);
    expect(() => ScoreBuilder.create().addSignal(signal(Number.POSITIVE_INFINITY))).toThrow(
      /finite/,
    );
    expect(() => ScoreBuilder.create().addSignals([signal(1), signal(-0.5)])).toThrow(/weight/);
  });
});

describe("strength thresholds", () => {
  it("rejects thresholds outside [0, 100] or out of order", () => {
    expect(() => ScoreBuilder.create().setThresholds(120, 50, 30)).toThrow(/between 0 and 100/);
    // weak above moderate made the "moderate" band unreachable
    expect(() => ScoreBuilder.create().setThresholds(70, 30, 50)).toThrow(/strongThreshold >=/);
    expect(() =>
      calculateScore(candles, 4, { signals: [signal(1)], strongThreshold: Number.NaN }),
    ).toThrow(/strongThreshold/);
  });

  it("accepts equal thresholds", () => {
    expect(() => ScoreBuilder.create().setThresholds(50, 50, 50)).not.toThrow();
  });
});

describe("score conditions", () => {
  const config: ScoringConfig = { signals: [signal(1)] };

  it.each([
    ["scoreAbove threshold", () => scoreAbove(150, config)],
    ["scoreBelow threshold", () => scoreBelow(-5, config)],
    ["scoreWithMinSignals threshold", () => scoreWithMinSignals(Number.NaN, 1, config)],
    ["scoreWithMinSignals minActive", () => scoreWithMinSignals(50, 1.5, config)],
    ["minActiveSignals minActive", () => minActiveSignals(-1, config)],
    ["scoreIncreasing minIncrease", () => scoreIncreasing(Number.NaN, config)],
    ["isScoreAbove threshold", () => isScoreAbove(candles, 4, 101, config)],
    ["isScoreBelow threshold", () => isScoreBelow(candles, 4, -1, config)],
  ])("rejects a bad %s", (label, create) => {
    expect(create).toThrow(new RegExp(label));
  });

  it("checks the configuration when the condition is created", () => {
    expect(() => scoreStrength("strong", configWith(-1))).toThrow(/scoreStrength signals\[1\]/);
    expect(() => minActiveSignals(1, configWith(Number.NaN))).toThrow(/minActiveSignals/);
  });

  it("accepts 0 for minActive and the threshold boundaries", () => {
    expect(() => minActiveSignals(0, config)).not.toThrow();
    expect(() => scoreAbove(0, config)).not.toThrow();
    expect(() => scoreBelow(100, config)).not.toThrow();
  });
});
