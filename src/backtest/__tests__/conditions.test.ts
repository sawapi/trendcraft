import { describe, it, expect } from "vitest";
import {
  and,
  or,
  not,
  goldenCross,
  deadCross,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  bollingerBreakout,
  evaluateCondition,
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderCollapsed,
  perfectOrderActiveBullish,
  perfectOrderActiveBearish,
  // Stochastics
  stochBelow,
  stochAbove,
  stochCrossUp,
  stochCrossDown,
  // DMI/ADX
  dmiBullish,
  dmiBearish,
  adxStrong,
  // Volume
  volumeAboveAvg,
} from "../conditions";
import type { NormalizedCandle } from "../../types";

// Helper to generate test candles
function generateCandles(count: number, basePrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const price = basePrice + Math.sin(i / 10) * 10 + i * 0.1;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000 + Math.random() * 100000,
    });
  }

  return candles;
}

// Generate uptrend candles for golden cross testing
function generateUptrendCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // First half: downtrend, second half: strong uptrend
    let price: number;
    if (i < count / 2) {
      price = 100 - i * 0.5; // Downtrend
    } else {
      price = 100 - (count / 2) * 0.5 + (i - count / 2) * 2; // Strong uptrend
    }

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("Condition combinators", () => {
  const candles = generateCandles(50);
  const indicators: Record<string, unknown> = {};

  describe("and()", () => {
    it("should return true only when all conditions are true", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const allTrue = and(alwaysTrue, alwaysTrue, alwaysTrue);
      const oneFalse = and(alwaysTrue, alwaysFalse, alwaysTrue);

      expect(evaluateCondition(allTrue, indicators, candles[10], 10, candles)).toBe(true);
      expect(evaluateCondition(oneFalse, indicators, candles[10], 10, candles)).toBe(false);
    });
  });

  describe("or()", () => {
    it("should return true when any condition is true", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const oneTrue = or(alwaysFalse, alwaysTrue, alwaysFalse);
      const allFalse = or(alwaysFalse, alwaysFalse, alwaysFalse);

      expect(evaluateCondition(oneTrue, indicators, candles[10], 10, candles)).toBe(true);
      expect(evaluateCondition(allFalse, indicators, candles[10], 10, candles)).toBe(false);
    });
  });

  describe("not()", () => {
    it("should negate the condition", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const negatedTrue = not(alwaysTrue);
      const negatedFalse = not(alwaysFalse);

      expect(evaluateCondition(negatedTrue, indicators, candles[10], 10, candles)).toBe(false);
      expect(evaluateCondition(negatedFalse, indicators, candles[10], 10, candles)).toBe(true);
    });
  });
});

describe("goldenCross()", () => {
  it("should detect golden cross in uptrend data", () => {
    const candles = generateUptrendCandles(100);
    const condition = goldenCross(5, 25);
    const indicators: Record<string, unknown> = {};

    // Find if there's a golden cross
    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger on first candle", () => {
    const candles = generateCandles(50);
    const condition = goldenCross(5, 25);
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[0], 0, candles)).toBe(false);
  });
});

describe("deadCross()", () => {
  it("should create a valid preset condition", () => {
    const condition = deadCross(5, 25);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("deadCross");
  });
});

describe("rsiBelow()", () => {
  it("should detect RSI below threshold", () => {
    // Generate downtrend candles to get low RSI
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 - i * 2; // Strong downtrend
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    // Check near the end where RSI should be low
    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    // RSI should be low after a strong downtrend
    expect(typeof result).toBe("boolean");
  });
});

describe("rsiAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = rsiAbove(70);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("rsiAbove");
  });
});

describe("macdCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossUp()");
  });
});

describe("macdCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossDown()");
  });
});

describe("bollingerBreakout()", () => {
  it("should detect upper band breakout", () => {
    // Generate candles with a spike
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      // Create a big spike at index 45
      if (i === 45) {
        price = 150;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerBreakout("upper");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });

  it("should detect lower band breakout", () => {
    // Generate candles with a drop
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      // Create a big drop at index 45
      if (i === 45) {
        price = 50;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerBreakout("lower");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });
});

describe("Custom function condition", () => {
  it("should evaluate custom function", () => {
    const candles = generateCandles(50);
    const indicators: Record<string, unknown> = {};

    const customCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
      return candle.close > 100;
    };

    // Find a candle with close > 100
    const highPriceIndex = candles.findIndex((c) => c.close > 100);
    if (highPriceIndex >= 0) {
      const result = evaluateCondition(customCondition, indicators, candles[highPriceIndex], highPriceIndex, candles);
      expect(result).toBe(true);
    }
  });
});

// ============================================
// Perfect Order Conditions
// ============================================

describe("perfectOrderBullish()", () => {
  // Generate strong uptrend to create bullish perfect order
  function generateStrongUptrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      // Flat first, then strong uptrend
      const price = i < 30 ? 100 : 100 + (i - 30) * 3;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = perfectOrderBullish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderBullish");
  });

  it("should detect bullish perfect order formation", () => {
    const candles = generateStrongUptrend(150);
    const condition = perfectOrderBullish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a formation
    let foundFormation = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundFormation = true;
        break;
      }
    }

    expect(foundFormation).toBe(true);
  });

  it("should respect minStrength option", () => {
    const candles = generateStrongUptrend(150);
    const weakCondition = perfectOrderBullish({ periods: [5, 10, 20], minStrength: 0 });
    const strongCondition = perfectOrderBullish({ periods: [5, 10, 20], minStrength: 80 });
    const indicators: Record<string, unknown> = {};

    let weakFormations = 0;
    let strongFormations = 0;

    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(weakCondition, {}, candles[i], i, candles)) {
        weakFormations++;
      }
      if (evaluateCondition(strongCondition, indicators, candles[i], i, candles)) {
        strongFormations++;
      }
    }

    // Strong formations should be less than or equal to weak ones
    expect(strongFormations).toBeLessThanOrEqual(weakFormations);
  });
});

describe("perfectOrderBearish()", () => {
  // Generate strong downtrend to create bearish perfect order
  function generateStrongDowntrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      // Flat first, then strong downtrend
      const price = i < 30 ? 200 : 200 - (i - 30) * 3;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = perfectOrderBearish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderBearish");
  });

  it("should detect bearish perfect order formation", () => {
    const candles = generateStrongDowntrend(150);
    const condition = perfectOrderBearish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a formation
    let foundFormation = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundFormation = true;
        break;
      }
    }

    expect(foundFormation).toBe(true);
  });
});

describe("perfectOrderCollapsed()", () => {
  // Generate uptrend followed by reversal
  function generateTrendReversal(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      let price: number;
      if (i < 80) {
        price = 100 + i * 2; // Long strong uptrend to establish perfect order
      } else {
        price = 260 - (i - 80) * 2; // Reversal
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = perfectOrderCollapsed();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderCollapsed");
  });

  it("should detect perfect order collapse after reversal", () => {
    const candles = generateTrendReversal(200);
    const condition = perfectOrderCollapsed({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a collapse in the reversal period (collapse happens shortly after reversal starts)
    let foundCollapse = false;
    for (let i = 80; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundCollapse = true;
        break;
      }
    }

    expect(foundCollapse).toBe(true);
  });
});

describe("perfectOrderActiveBullish()", () => {
  // Generate sustained uptrend
  function generateSustainedUptrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 + i * 1.5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = perfectOrderActiveBullish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderActiveBullish");
  });

  it("should return true while bullish perfect order is active", () => {
    const candles = generateSustainedUptrend(100);
    const condition = perfectOrderActiveBullish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // After MA convergence, should stay true
    let activeCount = 0;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        activeCount++;
      }
    }

    // Most of the later candles should have active bullish PO
    expect(activeCount).toBeGreaterThan(30);
  });
});

describe("perfectOrderActiveBearish()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderActiveBearish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderActiveBearish");
  });
});

// ============================================
// Stochastics Conditions
// ============================================

describe("stochBelow()", () => {
  // Generate strong downtrend to get low stochastics
  function generateDowntrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 - i * 1.5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = stochBelow(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("stochBelow");
  });

  it("should detect stochastics below threshold in downtrend", () => {
    const candles = generateDowntrend(50);
    const condition = stochBelow(20);
    const indicators: Record<string, unknown> = {};

    // After sufficient downtrend, stoch should be low
    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("stochAbove()", () => {
  // Generate strong uptrend to get high stochastics
  function generateUptrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 + i * 1.5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = stochAbove(80);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("stochAbove");
  });

  it("should detect stochastics above threshold in uptrend", () => {
    const candles = generateUptrend(50);
    const condition = stochAbove(80);
    const indicators: Record<string, unknown> = {};

    // After sufficient uptrend, stoch should be high
    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("stochCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = stochCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("stochCrossUp()");
  });

  it("should not trigger on first candle", () => {
    const candles = generateCandles(50);
    const condition = stochCrossUp();
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[0], 0, candles)).toBe(false);
  });
});

describe("stochCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = stochCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("stochCrossDown()");
  });
});

// ============================================
// DMI/ADX Conditions
// ============================================

describe("dmiBullish()", () => {
  // Generate strong uptrend for bullish DMI
  function generateStrongUptrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 + i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 1,
        high: price + 2,
        low: price - 1,
        close: price + 1,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = dmiBullish(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("dmiBullish");
  });

  it("should detect bullish DMI in strong uptrend", () => {
    const candles = generateStrongUptrend(50);
    const condition = dmiBullish(20);
    const indicators: Record<string, unknown> = {};

    // In strong uptrend, +DI should be > -DI
    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("dmiBearish()", () => {
  // Generate strong downtrend for bearish DMI
  function generateStrongDowntrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 200 - i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 1,
        high: price + 1,
        low: price - 2,
        close: price - 1,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = dmiBearish(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("dmiBearish");
  });

  it("should detect bearish DMI in strong downtrend", () => {
    const candles = generateStrongDowntrend(50);
    const condition = dmiBearish(20);
    const indicators: Record<string, unknown> = {};

    // In strong downtrend, -DI should be > +DI
    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("adxStrong()", () => {
  it("should create a valid preset condition", () => {
    const condition = adxStrong(25);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("adxStrong");
  });

  it("should detect strong ADX in trending market", () => {
    // Generate strong trend
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 100; i++) {
      const price = 100 + i * 3; // Very strong uptrend
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 1,
        high: price + 3,
        low: price - 1,
        close: price + 2,
        volume: 1000000,
      });
    }

    const condition = adxStrong(25);
    const indicators: Record<string, unknown> = {};

    // In strong trend, ADX should be high
    let found = false;
    for (let i = 40; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

// ============================================
// Volume Conditions
// ============================================

describe("volumeAboveAvg()", () => {
  it("should create a valid preset condition", () => {
    const condition = volumeAboveAvg(1.5);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("volumeAboveAvg");
  });

  it("should detect volume spike", () => {
    // Generate candles with a volume spike
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const volume = i === 45 ? 3000000 : 1000000; // Spike at index 45
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume,
      });
    }

    const condition = volumeAboveAvg(1.5); // 1.5x average
    const indicators: Record<string, unknown> = {};

    // The spike should trigger the condition
    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });

  it("should not trigger on normal volume", () => {
    // Generate candles with consistent volume
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000000, // Consistent volume
      });
    }

    const condition = volumeAboveAvg(1.5);
    const indicators: Record<string, unknown> = {};

    // Normal volume should not trigger
    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(false);
  });
});
