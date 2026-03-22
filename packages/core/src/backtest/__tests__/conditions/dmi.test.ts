import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { adxStrong, dmiBearish, dmiBullish, evaluateCondition } from "../../conditions";

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
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 100; i++) {
      const price = 100 + i * 3;
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

    let found = false;
    for (let i = 40; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger in flat/range-bound market", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 60; i++) {
      // Flat price with minimal movement
      const price = 100 + (i % 2 === 0 ? 0.5 : -0.5);
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.3,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = adxStrong(25);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(false);
  });
});
