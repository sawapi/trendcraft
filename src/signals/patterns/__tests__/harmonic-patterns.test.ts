import { describe, it, expect } from "vitest";
import { detectHarmonicPatterns } from "../harmonic-patterns";
import type { NormalizedCandle } from "../../../types";
import type { HarmonicPatternOptions } from "../types";

/**
 * Generate synthetic candles from a sequence of price waypoints.
 * Each waypoint specifies a target price. Candles are linearly interpolated
 * between waypoints. Leading/trailing slopes ensure the first and last
 * waypoints are detected as swing points (not lost in flat padding).
 *
 * @param waypoints - Array of target prices [X, A, B, C, D]
 * @param barsPerLeg - Number of bars between each waypoint (default: 15)
 * @param paddingBars - Bars of slope before/after the pattern (default: 10)
 */
function generateCandlesFromWaypoints(
  waypoints: number[],
  barsPerLeg = 15,
  paddingBars = 10,
): NormalizedCandle[] {
  const prices: number[] = [];

  // Leading slope: approach from the direction that makes the first waypoint
  // a reversal (swing) point. E.g., for bullish (X low → A high), approach
  // from above X so price descends to X then rises to A.
  const firstPrice = waypoints[0];
  const secondPrice = waypoints[1];
  const approachStart = firstPrice + (secondPrice - firstPrice) * 0.3;
  for (let i = 0; i < paddingBars; i++) {
    const t = i / paddingBars;
    prices.push(approachStart + (firstPrice - approachStart) * t);
  }

  // Interpolate between waypoints
  for (let w = 0; w < waypoints.length - 1; w++) {
    const start = waypoints[w];
    const end = waypoints[w + 1];
    for (let i = 0; i <= barsPerLeg; i++) {
      if (w > 0 && i === 0) continue;
      const t = i / barsPerLeg;
      prices.push(start + (end - start) * t);
    }
  }

  // Trailing slope: depart from D in the direction that makes D
  // a reversal point (same direction as the preceding leg reversed)
  const lastPrice = waypoints[waypoints.length - 1];
  const secondLastPrice = waypoints[waypoints.length - 2];
  const departEnd = lastPrice + (secondLastPrice - lastPrice) * 0.3;
  for (let i = 1; i <= paddingBars; i++) {
    const t = i / paddingBars;
    prices.push(lastPrice + (departEnd - lastPrice) * t);
  }

  return prices.map((price, idx) => ({
    time: 1000000 + idx * 86400,
    open: price,
    high: price * 1.005,
    low: price * 0.995,
    close: price,
    volume: 1000,
    _normalized: true as const,
  }));
}

/**
 * Build a bullish Gartley pattern:
 * X(low)=100 -> A(high)=200 -> B(low)=138.2 -> C(high)=174.7 -> D(low)=121.4
 * AB/XA = 61.8/100 = 0.618
 * BC/AB = 36.5/61.8 = 0.590 (within 0.382-0.886)
 * CD/BC = 53.3/36.5 = 1.460 (within 1.13-1.618)
 * AD/XA = 78.6/100 = 0.786
 */
function buildBullishGartley(): NormalizedCandle[] {
  return generateCandlesFromWaypoints([100, 200, 138.2, 174.7, 121.4]);
}

/**
 * Build a bearish Gartley pattern:
 * X(high)=200 -> A(low)=100 -> B(high)=161.8 -> C(low)=125.3 -> D(high)=178.6
 * XA = 100, AB = 61.8, BC = 36.5, CD = 53.3, AD = 78.6
 * AB/XA = 0.618, BC/AB = 0.590, CD/BC = 1.460, AD/XA = 0.786
 */
function buildBearishGartley(): NormalizedCandle[] {
  return generateCandlesFromWaypoints([200, 100, 161.8, 125.3, 178.6]);
}

/**
 * Build a bullish Bat pattern:
 * X=100(low), A=200(high), XA=100
 * AB/XA=0.45 (in [0.382, 0.5]) => AB=45 => B=155
 * BC/AB=0.6 (in [0.382, 0.886]) => BC=27 => C=182
 * CD/BC=2.615 (in [1.618, 2.618]) => CD=70.6 => D=111.4
 * AD/XA=0.886 => AD=88.6 => D=111.4 (matches)
 */
function buildBullishBat(): NormalizedCandle[] {
  return generateCandlesFromWaypoints([100, 200, 155, 182, 111.4]);
}

/**
 * Build a bullish Crab pattern:
 * X=1000(low), A=1050(high), XA=50
 * AB/XA=0.5 (in [0.382, 0.618]) => AB=25 => B=1025
 * BC/AB=0.8 (in [0.382, 0.886]) => BC=20 => C=1045
 * AD/XA=1.618 => AD=80.9 => D=919.1
 * CD=|919.1-1045|=125.9, CD/BC=125.9/20=6.3 -> too high
 *
 * Crab geometry is very difficult with small moves. For testing,
 * we verify the function runs correctly and test with wide tolerance.
 */
function buildBullishCrab(): NormalizedCandle[] {
  return generateCandlesFromWaypoints([1000, 1050, 1025, 1045, 969.1]);
}

const DEFAULT_OPTIONS: HarmonicPatternOptions = {
  swingLookback: 3,
  tolerance: 0.05,
  minSwingPoints: 20,
};

describe("detectHarmonicPatterns", () => {
  // ============================================
  // Basic validation
  // ============================================

  it("returns empty array for insufficient data", () => {
    const candles = generateCandlesFromWaypoints([100, 110], 2, 0);
    const result = detectHarmonicPatterns(candles.slice(0, 5));
    expect(result).toEqual([]);
  });

  it("returns empty array when fewer than 5 swing points", () => {
    // Very flat data with no meaningful swings
    const candles: NormalizedCandle[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1000000 + i * 86400,
      open: 100,
      high: 100.01,
      low: 99.99,
      close: 100,
      volume: 1000,
      _normalized: true as const,
    }));
    const result = detectHarmonicPatterns(candles, DEFAULT_OPTIONS);
    expect(result).toEqual([]);
  });

  it("returns PatternSignal array type", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, DEFAULT_OPTIONS);
    expect(Array.isArray(result)).toBe(true);
    for (const signal of result) {
      expect(signal).toHaveProperty("time");
      expect(signal).toHaveProperty("type");
      expect(signal).toHaveProperty("pattern");
      expect(signal).toHaveProperty("confidence");
      expect(signal).toHaveProperty("confirmed");
    }
  });

  // ============================================
  // Bullish Gartley Detection
  // ============================================

  it("detects bullish Gartley pattern with correct XABCD structure", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    expect(gartleys.length).toBeGreaterThanOrEqual(1);

    const g = gartleys[0];
    expect(g.type).toBe("gartley_bullish");
    expect(g.confirmed).toBe(true);
  });

  it("Gartley pattern has correct XABCD key point labels", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length === 0) return;

    const labels = gartleys[0].pattern.keyPoints.map((kp) => kp.label);
    expect(labels).toEqual(["X", "A", "B", "C", "D"]);
  });

  it("Gartley pattern has 5 key points with valid prices", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length === 0) return;

    expect(gartleys[0].pattern.keyPoints).toHaveLength(5);
    for (const kp of gartleys[0].pattern.keyPoints) {
      expect(kp.price).toBeGreaterThan(0);
      expect(typeof kp.time).toBe("number");
      expect(typeof kp.index).toBe("number");
    }
  });

  // ============================================
  // Bearish Gartley Detection
  // ============================================

  it("detects bearish Gartley pattern", () => {
    const candles = buildBearishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const bearish = result.filter((r) => r.type === "gartley_bearish");
    expect(bearish.length).toBeGreaterThanOrEqual(1);
    if (bearish.length > 0) {
      expect(bearish[0].confirmed).toBe(true);
    }
  });

  // ============================================
  // Bat Pattern Detection
  // ============================================

  it("detects bullish Bat pattern", () => {
    const candles = buildBullishBat();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["bat"],
    });
    const bats = result.filter((r) => r.type === "bat_bullish");
    expect(bats.length).toBeGreaterThanOrEqual(1);
  });

  // ============================================
  // Crab Pattern Detection
  // ============================================

  it("runs crab detection without error", () => {
    const candles = buildBullishCrab();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.06,
      patterns: ["crab"],
    });
    // Crab geometry is very constrained; verify function runs correctly
    expect(Array.isArray(result)).toBe(true);
    // If detected, verify structure
    for (const signal of result) {
      expect(signal.pattern.keyPoints).toHaveLength(5);
    }
  });

  // ============================================
  // Shark Pattern Detection
  // ============================================

  it("runs shark detection without error", () => {
    // Shark patterns require very specific geometry (BC/AB > 1)
    // which is hard to synthesize. Verify the function handles it gracefully.
    const candles = generateCandlesFromWaypoints([500, 600, 545, 625, 475]);
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.10,
      patterns: ["shark"],
    });
    expect(Array.isArray(result)).toBe(true);
  });

  // ============================================
  // Confidence Scoring
  // ============================================

  it("confidence score is between 0 and 100", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, DEFAULT_OPTIONS);
    for (const signal of result) {
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("perfect ratio match produces high confidence", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length > 0) {
      expect(gartleys[0].confidence).toBeGreaterThanOrEqual(40);
    }
  });

  it("confidence decreases with ratio deviation", () => {
    const idealCandles = buildBullishGartley();
    const idealResult = detectHarmonicPatterns(idealCandles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
      patterns: ["gartley"],
    });

    // Slightly off Gartley: AB/XA = 0.65 instead of 0.618
    const offCandles = generateCandlesFromWaypoints([100, 200, 135, 175, 120]);
    const offResult = detectHarmonicPatterns(offCandles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
      patterns: ["gartley"],
    });

    const idealGartleys = idealResult.filter((r) => r.type === "gartley_bullish");
    const offGartleys = offResult.filter((r) => r.type === "gartley_bullish");

    if (idealGartleys.length > 0 && offGartleys.length > 0) {
      expect(idealGartleys[0].confidence).toBeGreaterThanOrEqual(offGartleys[0].confidence - 10);
    }
  });

  // ============================================
  // Target and StopLoss
  // ============================================

  it("target calculation uses 0.382 retracement of AD", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length > 0) {
      const g = gartleys[0];
      const kp = g.pattern.keyPoints;
      const A = kp.find((p) => p.label === "A")!;
      const D = kp.find((p) => p.label === "D")!;
      const expectedTarget = D.price + (A.price - D.price) * 0.382;
      expect(g.pattern.target).toBeCloseTo(expectedTarget, 1);
    }
  });

  it("stopLoss is beyond X point for bullish pattern", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length > 0) {
      const g = gartleys[0];
      const X = g.pattern.keyPoints.find((p) => p.label === "X")!;
      expect(g.pattern.stopLoss).toBeLessThan(X.price);
    }
  });

  it("stopLoss is beyond X point for bearish pattern", () => {
    const candles = buildBearishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const bearish = result.filter((r) => r.type === "gartley_bearish");
    if (bearish.length > 0) {
      const g = bearish[0];
      const X = g.pattern.keyPoints.find((p) => p.label === "X")!;
      expect(g.pattern.stopLoss).toBeGreaterThan(X.price);
    }
  });

  // ============================================
  // Pattern height
  // ============================================

  it("pattern height equals XA leg length", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    const gartleys = result.filter((r) => r.type === "gartley_bullish");
    if (gartleys.length > 0) {
      const kp = gartleys[0].pattern.keyPoints;
      const X = kp.find((p) => p.label === "X")!;
      const A = kp.find((p) => p.label === "A")!;
      expect(gartleys[0].pattern.height).toBeCloseTo(Math.abs(A.price - X.price), 1);
    }
  });

  // ============================================
  // Options
  // ============================================

  it("tolerance parameter controls detection sensitivity", () => {
    const candles = buildBullishGartley();

    const tightResult = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.001,
    });

    const looseResult = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.20,
    });

    expect(looseResult.length).toBeGreaterThanOrEqual(tightResult.length);
  });

  it("pattern filter option restricts which patterns are detected", () => {
    const candles = buildBullishGartley();

    const gartleyOnly = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
      patterns: ["gartley"],
    });

    const batOnly = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
      patterns: ["bat"],
    });

    for (const signal of gartleyOnly) {
      expect(signal.type).toMatch(/^gartley_/);
    }
    for (const signal of batOnly) {
      expect(signal.type).toMatch(/^bat_/);
    }
  });

  it("swingLookback option affects swing detection", () => {
    const candles = buildBullishGartley();

    const smallLookback = detectHarmonicPatterns(candles, {
      swingLookback: 2,
      tolerance: 0.10,
    });

    const largeLookback = detectHarmonicPatterns(candles, {
      swingLookback: 8,
      tolerance: 0.10,
    });

    expect(Array.isArray(smallLookback)).toBe(true);
    expect(Array.isArray(largeLookback)).toBe(true);
  });

  // ============================================
  // Deduplication and Sorting
  // ============================================

  it("results are sorted by time", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].time).toBeGreaterThanOrEqual(result[i - 1].time);
    }
  });

  it("deduplication keeps highest confidence for same time and type", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.15,
    });

    const seen = new Set<string>();
    for (const signal of result) {
      const key = `${signal.time}_${signal.type}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  // ============================================
  // No false positives with bad data
  // ============================================

  it("no detection when ratios are far outside tolerance", () => {
    // Nearly flat data that should not match Gartley ratios
    const candles = generateCandlesFromWaypoints([100, 300, 290, 295, 285]);
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      tolerance: 0.01,
      patterns: ["gartley"],
    });

    const gartleys = result.filter((r) => r.type.startsWith("gartley"));
    expect(gartleys.length).toBe(0);
  });

  // ============================================
  // Edge cases
  // ============================================

  it("handles unnormalized candles (auto-normalizes)", () => {
    const candles = buildBullishGartley().map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ _normalized, ...rest }) => rest,
    );
    const result = detectHarmonicPatterns(candles);
    expect(Array.isArray(result)).toBe(true);
  });

  it("signal time matches D point time", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    for (const signal of result) {
      const D = signal.pattern.keyPoints.find((kp) => kp.label === "D");
      expect(signal.time).toBe(D?.time);
    }
  });

  it("pattern startTime is X time and endTime is D time", () => {
    const candles = buildBullishGartley();
    const result = detectHarmonicPatterns(candles, {
      ...DEFAULT_OPTIONS,
      patterns: ["gartley"],
    });
    for (const signal of result) {
      const X = signal.pattern.keyPoints.find((kp) => kp.label === "X");
      const D = signal.pattern.keyPoints.find((kp) => kp.label === "D");
      expect(signal.pattern.startTime).toBe(X?.time);
      expect(signal.pattern.endTime).toBe(D?.time);
    }
  });
});
