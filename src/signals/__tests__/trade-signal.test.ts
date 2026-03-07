/**
 * Tests for Trade Signal Converters (Feature 1)
 */
import { describe, it, expect } from "vitest";
import {
  fromCrossSignal,
  fromDivergenceSignal,
  fromSqueezeSignal,
  fromPatternSignal,
  fromScoreResult,
  fromPipelineResult,
} from "../trade-signal/converters";
import type { CrossSignalQuality } from "../cross";
import type { DivergenceSignal } from "../divergence";
import type { SqueezeSignal } from "../bollinger-squeeze";
import type { PatternSignal } from "../patterns/types";
import type { ScoreBreakdown } from "../../types/scoring";
import type { PipelineResult } from "../../streaming/types";

describe("fromCrossSignal", () => {
  const goldenSignal: CrossSignalQuality = {
    time: 1000,
    type: "golden",
    isFake: false,
    score: 85,
    details: {
      volumeConfirmed: true,
      trendConfirmed: true,
      holdingConfirmed: true,
      pricePositionConfirmed: true,
      daysUntilReverse: null,
    },
  };

  it("converts golden cross to BUY/LONG signal", () => {
    const result = fromCrossSignal(goldenSignal, 100);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(85);
    expect(result.time).toBe(1000);
    expect(result.prices?.entry).toBe(100);
    expect(result.reasons[0].source).toBe("cross");
    expect(result.reasons[0].name).toBe("goldenCross");
  });

  it("converts dead cross to SELL/SHORT signal", () => {
    const deadSignal: CrossSignalQuality = {
      ...goldenSignal,
      type: "dead",
      score: 60,
    };
    const result = fromCrossSignal(deadSignal);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.confidence).toBe(60);
    expect(result.prices).toBeUndefined();
  });

  it("marks fake signals in metadata", () => {
    const fakeSignal = { ...goldenSignal, isFake: true };
    const result = fromCrossSignal(fakeSignal);
    expect(result.metadata?.isFake).toBe(true);
    expect(result.reasons[0].detail).toBe("potential fake signal");
  });
});

describe("fromDivergenceSignal", () => {
  it("converts bullish divergence to BUY", () => {
    const signal: DivergenceSignal = {
      time: 2000,
      type: "bullish",
      firstIdx: 5,
      secondIdx: 10,
      price: { first: 100, second: 95 },
      indicator: { first: 30, second: 35 },
    };
    const result = fromDivergenceSignal(signal, 95);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(60);
    expect(result.prices?.entry).toBe(95);
  });

  it("converts bearish divergence to SELL", () => {
    const signal: DivergenceSignal = {
      time: 3000,
      type: "bearish",
      firstIdx: 5,
      secondIdx: 10,
      price: { first: 100, second: 110 },
      indicator: { first: 70, second: 65 },
    };
    const result = fromDivergenceSignal(signal);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
  });
});

describe("fromSqueezeSignal", () => {
  it("converts squeeze signal with default LONG direction", () => {
    const signal: SqueezeSignal = {
      time: 4000,
      type: "squeeze",
      bandwidth: 0.02,
      percentile: 3,
    };
    const result = fromSqueezeSignal(signal);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(97); // 100 - 3
  });

  it("supports SHORT direction", () => {
    const signal: SqueezeSignal = {
      time: 4000,
      type: "squeeze",
      bandwidth: 0.02,
      percentile: 3,
    };
    const result = fromSqueezeSignal(signal, "SHORT", 150);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.prices?.entry).toBe(150);
  });
});

describe("fromPatternSignal", () => {
  it("converts double_bottom to BUY with price levels", () => {
    const signal: PatternSignal = {
      time: 5000,
      type: "double_bottom",
      pattern: {
        startTime: 4000,
        endTime: 5000,
        keyPoints: [],
        target: 120,
        stopLoss: 90,
        height: 10,
      },
      confidence: 72,
      confirmed: true,
    };
    const result = fromPatternSignal(signal, 100);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(72);
    expect(result.prices?.entry).toBe(100);
    expect(result.prices?.takeProfit).toBe(120);
    expect(result.prices?.stopLoss).toBe(90);
  });

  it("converts double_top to SELL", () => {
    const signal: PatternSignal = {
      time: 6000,
      type: "double_top",
      pattern: { startTime: 5000, endTime: 6000, keyPoints: [] },
      confidence: 65,
      confirmed: false,
    };
    const result = fromPatternSignal(signal);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.metadata?.confirmed).toBe(false);
  });
});

describe("fromScoreResult", () => {
  const breakdown: ScoreBreakdown = {
    rawScore: 0.72,
    normalizedScore: 72,
    maxScore: 50,
    strength: "strong" as const,
    activeSignals: 1,
    contributions: [
      { name: "rsiOversold", displayName: "RSI Oversold", rawValue: 1, score: 30, weight: 30, isActive: true },
      { name: "macdBullish", displayName: "MACD Bullish", rawValue: 0, score: 0, weight: 20, isActive: false },
    ],
  };

  it("converts score to signal", () => {
    const result = fromScoreResult(breakdown, 7000, { entryPrice: 100 });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(72);
    expect(result!.reasons.length).toBe(1); // Only active signals
    expect(result!.reasons[0].name).toBe("rsiOversold");
  });

  it("returns null when below threshold", () => {
    const result = fromScoreResult(breakdown, 7000, { minScore: 80 });
    expect(result).toBeNull();
  });

  it("supports custom direction", () => {
    const result = fromScoreResult(breakdown, 7000, { direction: "SHORT" });
    expect(result!.action).toBe("SELL");
    expect(result!.direction).toBe("SHORT");
  });
});

describe("fromPipelineResult", () => {
  it("converts entry signal", () => {
    const result: PipelineResult = {
      snapshot: { rsi14: 25 },
      entrySignal: true,
      exitSignal: false,
      signals: [],
    };
    const signal = fromPipelineResult(result, 8000, 100);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("BUY");
    expect(signal!.reasons).toContainEqual({ source: "pipeline", name: "entry" });
  });

  it("converts exit signal", () => {
    const result: PipelineResult = {
      snapshot: { rsi14: 75 },
      entrySignal: false,
      exitSignal: true,
      signals: [],
    };
    const signal = fromPipelineResult(result, 9000);
    expect(signal!.action).toBe("CLOSE");
  });

  it("returns null when no signals", () => {
    const result: PipelineResult = {
      snapshot: {},
      entrySignal: false,
      exitSignal: false,
      signals: [],
    };
    const signal = fromPipelineResult(result, 10000);
    expect(signal).toBeNull();
  });

  it("includes named signals in reasons", () => {
    const result: PipelineResult = {
      snapshot: {},
      entrySignal: false,
      exitSignal: false,
      signals: ["squeeze_breakout"],
    };
    const signal = fromPipelineResult(result, 11000);
    expect(signal!.reasons).toContainEqual({ source: "pipeline", name: "squeeze_breakout" });
  });
});
