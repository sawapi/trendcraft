import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  atrPercentAbove,
  atrPercentBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  evaluateCondition,
  regimeConfidenceAbove,
  regimeIs,
  regimeNot,
  volatilityAbove,
  volatilityBelow,
  volatilityContracting,
  volatilityExpanding,
} from "../../conditions";

/**
 * Generate candles with initial high-volatility period followed by low-volatility.
 * This ensures the low-vol section gets low percentile rankings.
 * Needs 200+ candles for volatilityRegime lookbackPeriod=100 default.
 */
function generateLowVolatilityCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const highVolEnd = Math.floor(count * 0.5);

  for (let i = 0; i < count; i++) {
    const price = 100 + i * 0.05;
    let range: number;
    if (i < highVolEnd) {
      // High volatility period
      range = 5 + Math.sin(i / 5) * 3;
    } else {
      // Very low volatility period
      range = 0.2;
    }
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - range * 0.3,
      high: price + range,
      low: price - range,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate high-volatility candles (large swings)
 */
function generateHighVolatilityCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const price = 100 + Math.sin(i / 5) * 20 + i * 0.5;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 3,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate candles with volatility expansion (low vol then high vol)
 */
function generateExpandingVolatility(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const midpoint = Math.floor(count * 0.6);

  for (let i = 0; i < count; i++) {
    const price = 100 + i * 0.2;
    const range = i < midpoint ? 0.5 : 8;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - range * 0.3,
      high: price + range,
      low: price - range,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate candles with volatility contraction (high vol then low vol)
 */
function generateContractingVolatility(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const midpoint = Math.floor(count * 0.6);

  for (let i = 0; i < count; i++) {
    const price = 100 + i * 0.2;
    const range = i < midpoint ? 8 : 0.5;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - range * 0.3,
      high: price + range,
      low: price - range,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// ============================================
// Regime Conditions
// ============================================

describe("regimeIs()", () => {
  it("should create a valid preset condition", () => {
    const condition = regimeIs("low");
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("regimeIs:low");
  });

  it("should detect low volatility regime in flat data", () => {
    // volatilityRegime needs lookbackPeriod=100 default, so use 200 candles
    const candles = generateLowVolatilityCandles(200);
    const condition = regimeIs("low");
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 50; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should return false for index 0", () => {
    const candles = generateLowVolatilityCandles(200);
    const condition = regimeIs("low");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[0], 0, candles);
    expect(result).toBe(false);
  });
});

describe("regimeNot()", () => {
  it("should create a valid preset condition", () => {
    const condition = regimeNot("high");
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("regimeNot:high");
  });

  it("should return true when regime is not the specified one", () => {
    const candles = generateLowVolatilityCandles(200);
    const condition = regimeNot("extreme");
    const indicators: Record<string, unknown> = {};

    // Low vol data should not be in extreme regime
    let found = false;
    for (let i = 50; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

// ============================================
// Volatility Percentile Conditions
// ============================================

describe("volatilityAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = volatilityAbove(70);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("volatilityAbove:70");
  });

  it("should detect high volatility in volatile data", () => {
    const candles = generateHighVolatilityCandles(200);
    const condition = volatilityAbove(50);
    const indicators: Record<string, unknown> = {};

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

describe("volatilityBelow()", () => {
  it("should create a valid preset condition", () => {
    const condition = volatilityBelow(30);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("volatilityBelow:30");
  });

  it("should detect low volatility in flat data", () => {
    const candles = generateLowVolatilityCandles(200);
    const condition = volatilityBelow(50);
    const indicators: Record<string, unknown> = {};

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

// ============================================
// ATR Percentile Conditions
// ============================================

describe("atrPercentileAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = atrPercentileAbove(70);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("atrPercentileAbove:70");
  });

  it("should detect high ATR percentile in volatile data", () => {
    const candles = generateHighVolatilityCandles(200);
    const condition = atrPercentileAbove(50);
    const indicators: Record<string, unknown> = {};

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

describe("atrPercentileBelow()", () => {
  it("should create a valid preset condition", () => {
    const condition = atrPercentileBelow(30);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("atrPercentileBelow:30");
  });

  it("should detect low ATR percentile in flat data", () => {
    const candles = generateLowVolatilityCandles(200);
    const condition = atrPercentileBelow(50);
    const indicators: Record<string, unknown> = {};

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

// ============================================
// Regime Confidence
// ============================================

describe("regimeConfidenceAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = regimeConfidenceAbove(0.7);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("regimeConfidenceAbove:0.7");
  });

  it("should detect high confidence in clear regime", () => {
    // Very clear low volatility should have high confidence
    const candles = generateLowVolatilityCandles(200);
    const condition = regimeConfidenceAbove(0.3);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should return false at beginning of data", () => {
    const candles = generateLowVolatilityCandles(100);
    const condition = regimeConfidenceAbove(0.5);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[0], 0, candles);
    expect(result).toBe(false);
  });
});

// ============================================
// Volatility Expanding/Contracting
// ============================================

describe("volatilityExpanding()", () => {
  it("should create a valid preset condition", () => {
    const condition = volatilityExpanding(20, 5);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("volatilityExpanding:20");
  });

  it("should return false when index < lookback", () => {
    const candles = generateExpandingVolatility(200);
    const condition = volatilityExpanding(20, 5);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[3], 3, candles);
    expect(result).toBe(false);
  });

  it("should detect expanding volatility", () => {
    const candles = generateExpandingVolatility(200);
    const condition = volatilityExpanding(10, 5);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 10; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    // After transition from low to high vol, expansion should be detected
    expect(found).toBe(true);
  });
});

describe("volatilityContracting()", () => {
  it("should create a valid preset condition", () => {
    const condition = volatilityContracting(20, 5);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("volatilityContracting:20");
  });

  it("should return false when index < lookback", () => {
    const candles = generateContractingVolatility(200);
    const condition = volatilityContracting(20, 5);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[2], 2, candles);
    expect(result).toBe(false);
  });

  it("should detect contracting volatility", () => {
    const candles = generateContractingVolatility(200);
    const condition = volatilityContracting(10, 5);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 10; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    // After transition from high to low vol, contraction should be detected
    expect(found).toBe(true);
  });
});

// ============================================
// ATR% Conditions
// ============================================

describe("atrPercentAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = atrPercentAbove(2.3);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("atrPercentAbove:2.3");
  });

  it("should detect high ATR% in volatile data", () => {
    const candles = generateHighVolatilityCandles(60);
    const condition = atrPercentAbove(1.0);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger in very low volatility data", () => {
    // Generate uniformly flat candles (ATR% measures ATR/price, so tiny range = low ATR%)
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 60; i++) {
      const price = 100 + i * 0.01;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.05,
        high: price + 0.1,
        low: price - 0.1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = atrPercentAbove(5.0);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(false);
  });
});

describe("atrPercentBelow()", () => {
  it("should create a valid preset condition", () => {
    const condition = atrPercentBelow(1.5);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("atrPercentBelow:1.5");
  });

  it("should detect low ATR% in flat data", () => {
    const candles = generateLowVolatilityCandles(60);
    const condition = atrPercentBelow(2.0);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger with very low threshold in volatile data", () => {
    const candles = generateHighVolatilityCandles(60);
    const condition = atrPercentBelow(0.01);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(false);
  });
});
