import { describe, expect, it } from "vitest";
import {
  createBearishVolumeTrendEvaluator,
  createBullishVolumeTrendEvaluator,
  createCmfNegativeEvaluator,
  createCmfPositiveEvaluator,
  createDeathCrossEvaluator,
  createGoldenCrossEvaluator,
  createHighVolumeUpCandleEvaluator,
  createMacdBearishEvaluator,
  createMacdBullishEvaluator,
  createPOConfirmationEvaluator,
  createPriceAboveEmaEvaluator,
  createPriceBelowEmaEvaluator,
  createPullbackEntryEvaluator,
  createRsiNeutralEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOverboughtEvaluator,
  createStochOversoldEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
} from "../signals";

/**
 * Every evaluator factory checks its arguments when it is called, not when a
 * bar is first scored. Several bad values never threw at all: they produced a
 * score with the wrong meaning.
 */
const REJECTED: [string, () => unknown, RegExp][] = [
  ["RSI oversold threshold above 100", () => createRsiOversoldEvaluator(130), /between 0 and 100/],
  ["RSI overbought threshold NaN", () => createRsiOverboughtEvaluator(Number.NaN), /finite/],
  ["RSI oversold period 0", () => createRsiOversoldEvaluator(30, 0), /period/],
  ["RSI neutral bounds reversed", () => createRsiNeutralEvaluator(60, 40), /must not exceed/],
  ["RSI neutral bound below 0", () => createRsiNeutralEvaluator(-5, 60), /between 0 and 100/],
  ["MACD fast >= slow", () => createMacdBullishEvaluator(26, 12), /less than slowPeriod/],
  ["MACD signal period 1.5", () => createMacdBearishEvaluator(12, 26, 1.5), /signalPeriod/],
  ["Stoch oversold threshold -1", () => createStochOversoldEvaluator(-1), /between 0 and 100/],
  ["Stoch overbought dPeriod 0", () => createStochOverboughtEvaluator(80, 14, 0), /dPeriod/],
  ["Stoch cross threshold 101", () => createStochBullishCrossEvaluator(101), /between 0 and 100/],
  ["PO confirmation slopeLookback 0", () => createPOConfirmationEvaluator(undefined, 0), /slope/],
  ["pullback tolerance -1", () => createPullbackEntryEvaluator(20, -1), /tolerancePercent/],
  ["pullback period NaN", () => createPullbackEntryEvaluator(Number.NaN), /maPeriod/],
  ["golden cross short >= long", () => createGoldenCrossEvaluator(200, 50), /less than long/],
  ["death cross equal periods", () => createDeathCrossEvaluator(50, 50), /less than long/],
  ["price above EMA period -3", () => createPriceAboveEmaEvaluator(-3), /period/],
  ["price below EMA period 2.5", () => createPriceBelowEmaEvaluator(2.5), /period/],
  ["volume spike threshold 0", () => createVolumeSpikeEvaluator(0), /threshold/],
  ["volume anomaly zThreshold -2", () => createVolumeAnomalyEvaluator(-2), /zThreshold/],
  ["bullish volume trend period 0", () => createBullishVolumeTrendEvaluator(0), /maPeriod/],
  [
    "bearish volume trend period NaN",
    () => createBearishVolumeTrendEvaluator(Number.NaN),
    /maPeriod/,
  ],
  ["CMF positive threshold -0.1", () => createCmfPositiveEvaluator(-0.1), /between 0 and 1/],
  ["CMF positive threshold 0", () => createCmfPositiveEvaluator(0), /greater than 0/],
  ["CMF positive threshold 1.5", () => createCmfPositiveEvaluator(1.5), /between 0 and 1/],
  // Scored any CMF up to +0.1 as negative money flow.
  ["CMF negative threshold +0.1", () => createCmfNegativeEvaluator(0.1), /between -1 and 0/],
  ["CMF negative threshold 0", () => createCmfNegativeEvaluator(0), /less than 0/],
  ["CMF negative period 0", () => createCmfNegativeEvaluator(-0.1, 0), /period/],
  ["high volume candle threshold 0", () => createHighVolumeUpCandleEvaluator(0), /volumeThreshold/],
];

describe("signal evaluator factories reject bad arguments", () => {
  for (const [name, create, message] of REJECTED) {
    it(name, () => {
      expect(create).toThrow(message);
    });
  }

  it("accepts the defaults and boundary values", () => {
    expect(() => createRsiOversoldEvaluator(0)).not.toThrow();
    expect(() => createRsiOverboughtEvaluator(100)).not.toThrow();
    expect(() => createRsiNeutralEvaluator(50, 50)).not.toThrow();
    expect(() => createCmfPositiveEvaluator(1)).not.toThrow();
    expect(() => createCmfNegativeEvaluator(-1)).not.toThrow();
    expect(() => createPullbackEntryEvaluator(20, 0)).not.toThrow();
    expect(() => createGoldenCrossEvaluator()).not.toThrow();
  });
});
