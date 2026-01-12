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
