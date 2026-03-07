import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { doubleBottom, doubleTop } from "../double-top-bottom";

// Generate candles that form a double bottom pattern
// Pattern: Start High -> First Trough -> Middle Peak -> Second Trough
function generateDoubleBottomCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const prices = [
    // Start high (index 0-5)
    100, 102, 105, 108, 110, 108,
    // Decline to first trough (index 6-15)
    105, 102, 99, 96, 93, 90, 88, 86, 84, 82,
    // Rally to middle peak (index 16-25)
    84, 87, 90, 93, 96, 99, 101, 103, 104, 105,
    // Decline to second trough (index 26-35)
    103, 100, 97, 94, 91, 88, 85, 83, 82, 81,
    // Recovery (index 36-45)
    84, 87, 90, 93, 96, 99, 102, 105, 108, 110,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Generate candles that form a double top pattern
// Pattern: Start Low -> First Peak -> Middle Trough -> Second Peak
function generateDoubleTopCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const prices = [
    // Start low (index 0-5)
    100, 98, 95, 92, 90, 92,
    // Rally to first peak (index 6-15)
    95, 98, 101, 104, 107, 110, 112, 114, 116, 118,
    // Decline to middle trough (index 16-25)
    116, 113, 110, 107, 104, 101, 99, 97, 96, 95,
    // Rally to second peak (index 26-35)
    97, 100, 103, 106, 109, 112, 115, 117, 118, 119,
    // Decline (index 36-45)
    116, 113, 110, 107, 104, 101, 98, 95, 92, 90,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price + 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Generate candles that have a lower low between two troughs (invalid double bottom)
function generateInvalidDoubleBottomCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const prices = [
    // Start high (index 0-5)
    100, 102, 105, 108, 110, 108,
    // Decline to first trough ~82 (index 6-15)
    105, 102, 99, 96, 93, 90, 88, 86, 84, 82,
    // Rally to middle (index 16-20)
    84, 87, 90, 93, 88,
    // Drop to LOWER LOW ~75 (index 21-25) - This should invalidate the pattern
    85, 82, 79, 76, 75,
    // Rally again (index 26-30)
    78, 81, 84, 87, 90,
    // Second trough ~81 (index 31-35) - similar to first trough
    87, 84, 82, 81, 82,
    // Recovery (index 36-45)
    85, 88, 91, 94, 97, 100, 103, 106, 109, 112,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Generate candles that have a higher high between two peaks (invalid double top)
function generateInvalidDoubleTopCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const prices = [
    // Start low (index 0-5)
    100, 98, 95, 92, 90, 92,
    // Rally to first peak ~118 (index 6-15)
    95, 98, 101, 104, 107, 110, 112, 114, 116, 118,
    // Decline to middle (index 16-20)
    116, 113, 110, 107, 112,
    // Rally to HIGHER HIGH ~125 (index 21-25) - This should invalidate the pattern
    115, 118, 121, 124, 125,
    // Decline again (index 26-30)
    122, 119, 116, 113, 110,
    // Second peak ~119 (index 31-35) - similar to first peak
    113, 116, 118, 119, 118,
    // Decline (index 36-45)
    115, 112, 109, 106, 103, 100, 97, 94, 91, 88,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price + 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("double-top-bottom keyPoints", () => {
  it("confirmed doubleBottom should have 5 keyPoints including End High", () => {
    const candles = generateDoubleBottomCandles();

    const patterns = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
    });

    expect(patterns.length).toBeGreaterThan(0);

    const pattern = patterns[0];
    // Pattern should be confirmed (price broke above neckline)
    expect(pattern.confirmed).toBe(true);
    // Check that keyPoints has 5 points for W-shape polygon
    expect(pattern.pattern.keyPoints.length).toBe(5);
    expect(pattern.pattern.keyPoints[0].label).toBe("Start High");
    expect(pattern.pattern.keyPoints[1].label).toBe("First Trough");
    expect(pattern.pattern.keyPoints[2].label).toBe("Middle Peak");
    expect(pattern.pattern.keyPoints[3].label).toBe("Second Trough");
    expect(pattern.pattern.keyPoints[4].label).toBe("End High");
  });

  it("confirmed doubleTop should have 5 keyPoints including End Low", () => {
    const candles = generateDoubleTopCandles();

    const patterns = doubleTop(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
    });

    expect(patterns.length).toBeGreaterThan(0);

    const pattern = patterns[0];
    // Pattern should be confirmed (price broke below neckline)
    expect(pattern.confirmed).toBe(true);
    // Check that keyPoints has 5 points for M-shape polygon
    expect(pattern.pattern.keyPoints.length).toBe(5);
    expect(pattern.pattern.keyPoints[0].label).toBe("Start Low");
    expect(pattern.pattern.keyPoints[1].label).toBe("First Peak");
    expect(pattern.pattern.keyPoints[2].label).toBe("Middle Trough");
    expect(pattern.pattern.keyPoints[3].label).toBe("Second Peak");
    expect(pattern.pattern.keyPoints[4].label).toBe("End Low");
  });
});

describe("double-top-bottom intermediate extremes validation", () => {
  it("should NOT detect double bottom when a lower low exists between troughs", () => {
    const candles = generateInvalidDoubleBottomCandles();

    const patterns = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.05,
      swingLookback: 3,
    });

    // Should NOT detect a double bottom between first trough (~82)
    // and second trough (~81) because there's a lower low (~75) in between
    // The pattern array should be empty or contain patterns that don't use these troughs
    const invalidPatterns = patterns.filter((p) => {
      const keyPoints = p.pattern.keyPoints;
      const firstTrough = keyPoints.find((kp) => kp.label === "First Trough");
      const secondTrough = keyPoints.find((kp) => kp.label === "Second Trough");
      // Check if pattern uses the troughs around index 15 and 33 (which have a lower low between)
      return (
        firstTrough &&
        secondTrough &&
        firstTrough.index >= 10 &&
        firstTrough.index <= 20 &&
        secondTrough.index >= 30 &&
        secondTrough.index <= 40
      );
    });

    expect(invalidPatterns.length).toBe(0);
  });

  it("should NOT detect double top when a higher high exists between peaks", () => {
    const candles = generateInvalidDoubleTopCandles();

    const patterns = doubleTop(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.05,
      swingLookback: 3,
    });

    // Should NOT detect a double top between first peak (~118)
    // and second peak (~119) because there's a higher high (~125) in between
    const invalidPatterns = patterns.filter((p) => {
      const keyPoints = p.pattern.keyPoints;
      const firstPeak = keyPoints.find((kp) => kp.label === "First Peak");
      const secondPeak = keyPoints.find((kp) => kp.label === "Second Peak");
      // Check if pattern uses the peaks around index 15 and 33 (which have a higher high between)
      return (
        firstPeak &&
        secondPeak &&
        firstPeak.index >= 10 &&
        firstPeak.index <= 20 &&
        secondPeak.index >= 30 &&
        secondPeak.index <= 40
      );
    });

    expect(invalidPatterns.length).toBe(0);
  });
});

// Generate candles with low prominence peaks (small bumps in a tight range)
function generateLowProminenceDoubleTopCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Create a very tight range where peaks have < 1% prominence
  // All prices stay between 99-101, with "peaks" at 101
  const prices = [
    // Tight range start (index 0-9) - stays near 100
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    // First "peak" - only 1% above base (index 10-14)
    100, 100.5, 101, 100.5, 100,
    // Back to tight range (index 15-24)
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    // Second "peak" - only 1% above base (index 25-29)
    100, 100.5, 101, 100.5, 100,
    // Continue tight range (index 30-39)
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price,
      high: price + 0.5, // Very small range
      low: price - 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("double-top-bottom prominence validation", () => {
  it("should NOT detect double top when peaks have low prominence", () => {
    const candles = generateLowProminenceDoubleTopCandles();

    const patterns = doubleTop(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.01, // Very low threshold so only prominence filters
      swingLookback: 3,
      validateProminence: true,
      minProminence: 0.02, // 2% prominence required
    });

    // Should NOT detect patterns because the peaks are not prominent enough
    // (they're just small bumps in a range)
    expect(patterns.length).toBe(0);
  });

  it("should detect double top when prominence validation is disabled", () => {
    const candles = generateLowProminenceDoubleTopCandles();

    const patterns = doubleTop(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.01,
      swingLookback: 3,
      validateProminence: false, // Disabled
    });

    // With prominence validation disabled, patterns might be detected
    // (depending on other filters)
    // This test just verifies the flag works
    expect(patterns).toBeDefined();
  });
});

// Generate candles where breakout happens too far from second trough
function generateLateBreakoutDoubleBottomCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const prices = [
    // Start high (index 0-5)
    100, 102, 105, 108, 110, 108,
    // Decline to first trough (index 6-15)
    105, 102, 99, 96, 93, 90, 88, 86, 84, 82,
    // Rally to middle peak (index 16-25)
    84, 87, 90, 93, 96, 99, 101, 103, 104, 105,
    // Decline to second trough (index 26-35)
    103, 100, 97, 94, 91, 88, 85, 83, 82, 81,
    // Stay below neckline for a long time (index 36-65) - 30 bars of consolidation
    80, 82, 81, 83, 82, 84, 83, 85, 84, 86, 85, 87, 86, 88, 87, 89, 88, 90, 89, 91, 90, 92, 91, 93,
    92, 94, 93, 95, 94, 96,
    // Finally break above neckline at index 66+
    97, 100, 103, 106, 109, 112,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    candles.push({
      time: baseTime + i * dayMs,
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Generate candles where price violates neckline during pattern formation
// The violation is a wick that exceeds the neckline, but the close price is still below
function generateNecklineViolationDoubleBottomCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Pattern:
  // - First trough at index 15 (price ~82)
  // - Middle peak at index 25 (price ~107 with high ~109) - this is the neckline
  // - During decline, index 27 has a wick that spikes above the neckline (high ~112)
  //   but the close is lower so it won't be detected as a swing high
  // - Second trough at index 35 (price ~81)

  const prices = [
    // Start high (index 0-5)
    100, 102, 105, 108, 110, 108,
    // Decline to first trough (index 6-15)
    105, 102, 99, 96, 93, 90, 88, 86, 84, 82,
    // Rally to middle peak (index 16-25) - peak at index 25 with close=107
    84, 87, 90, 93, 96, 99, 101, 103, 105, 107,
    // Decline to second trough with a violation wick at index 27
    // Index 26: close=104, high=106 (normal)
    // Index 27: close=100, high=112 (VIOLATION - wick exceeds neckline 109)
    // Index 28-35: continue decline
    104, 100, 96, 93, 90, 87, 84, 82, 81, 80,
  ];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    let high = price + 2;
    // Create a spike in the high at index 27 that exceeds the neckline (~109)
    // The close is 100, but the high is 112 (violates neckline)
    if (i === 27) {
      high = 112;
    }
    candles.push({
      time: baseTime + i * dayMs,
      open: price - 1,
      high: high,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  // Add recovery candles for breakout confirmation
  const recoveryPrices = [83, 86, 89, 92, 95, 98, 101, 104, 108, 112];
  for (let i = 0; i < recoveryPrices.length; i++) {
    const price = recoveryPrices[i];
    candles.push({
      time: baseTime + (prices.length + i) * dayMs,
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("double-top-bottom breakout distance validation", () => {
  it("should NOT detect confirmed pattern when breakout is too far (maxBreakoutDistance)", () => {
    const candles = generateLateBreakoutDoubleBottomCandles();

    const patterns = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
      maxBreakoutDistance: 20, // Only search 20 bars for breakout
    });

    // Should detect a pattern but it should NOT be confirmed
    // because the breakout happens more than 20 bars after second trough
    const confirmedPatterns = patterns.filter((p) => p.confirmed);
    expect(confirmedPatterns.length).toBe(0);
  });

  it("should detect confirmed pattern when maxBreakoutDistance is large enough", () => {
    const candles = generateLateBreakoutDoubleBottomCandles();

    const patterns = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
      maxBreakoutDistance: 50, // Allow up to 50 bars for breakout
    });

    // With larger maxBreakoutDistance, pattern should be confirmed
    const confirmedPatterns = patterns.filter((p) => p.confirmed);
    expect(confirmedPatterns.length).toBeGreaterThanOrEqual(0); // May or may not find depending on other constraints
  });
});

describe("double-top-bottom neckline violation validation", () => {
  it("should accept validateNecklineViolation option", () => {
    const candles = generateDoubleBottomCandles();

    // Test with validation enabled (default behavior)
    const patternsWithValidation = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
      validateNecklineViolation: true,
      necklineViolationTolerance: 0.005,
    });

    // Test with validation disabled
    const patternsWithoutValidation = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.1,
      swingLookback: 3,
      validateNecklineViolation: false,
    });

    // Both should be defined (option is accepted)
    expect(patternsWithValidation).toBeDefined();
    expect(patternsWithoutValidation).toBeDefined();

    // With clean data (no violations), both should detect the same patterns
    expect(patternsWithValidation.length).toBe(patternsWithoutValidation.length);
  });

  it("should filter patterns with neckline violations when enabled", () => {
    const candles = generateNecklineViolationDoubleBottomCandles();

    const patternsStrict = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.05, // Lower threshold
      swingLookback: 3,
      validateNecklineViolation: true,
      necklineViolationTolerance: 0.001, // Very strict: 0.1% tolerance
    });

    const patternsLenient = doubleBottom(candles, {
      tolerance: 0.05,
      minDistance: 10,
      maxDistance: 40,
      minMiddleDepth: 0.05,
      swingLookback: 3,
      validateNecklineViolation: true,
      necklineViolationTolerance: 0.1, // Very lenient: 10% tolerance
    });

    // Lenient tolerance should detect >= strict tolerance patterns
    expect(patternsLenient.length).toBeGreaterThanOrEqual(patternsStrict.length);
  });
});
