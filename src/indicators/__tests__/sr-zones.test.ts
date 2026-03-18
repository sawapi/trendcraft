import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { srZones } from "../price/sr-zones";

/** Helper: create a normalized candle. */
function candle(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000,
): NormalizedCandle {
  return {
    time: 1700000000 + i * 86400,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Build a 30-candle dataset around 95-105 with a clear swing high (~105)
 * and swing low (~95).
 */
function makeSwingCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  // Rise from 97 to 105
  for (let i = 0; i < 10; i++) {
    const mid = 97 + i * 0.9;
    candles.push(candle(i, mid - 0.3, mid + 1, mid - 1, mid + 0.3, 1000 + i * 100));
  }
  // Drop from 105 to 95
  for (let i = 10; i < 20; i++) {
    const mid = 105 - (i - 10) * 1.1;
    candles.push(candle(i, mid + 0.3, mid + 1, mid - 1, mid - 0.3, 1000 + i * 100));
  }
  // Rise from 95 to 100
  for (let i = 20; i < 30; i++) {
    const mid = 95 + (i - 20) * 0.5;
    candles.push(candle(i, mid - 0.2, mid + 0.8, mid - 0.8, mid + 0.2, 1000 + i * 100));
  }
  return candles;
}

describe("srZones", () => {
  it("returns empty zones for empty candles", () => {
    const result = srZones([]);
    expect(result.zones).toEqual([]);
    expect(result.rawLevels).toEqual([]);
  });

  it("finds zones around clear swing high and low", () => {
    const data = makeSwingCandles();
    const result = srZones(data, {
      swingLookback: 3,
      includeRoundNumbers: false,
      includeVwap: false,
      includeVolumeProfile: false,
      includePivotPoints: false,
    });

    expect(result.zones.length).toBeGreaterThan(0);
    // At least some swing levels should be collected
    expect(result.rawLevels.length).toBeGreaterThan(0);
    expect(result.rawLevels.every((l) => l.source === "swing")).toBe(true);

    // All zone prices should be finite numbers
    for (const z of result.zones) {
      expect(Number.isFinite(z.price)).toBe(true);
      expect(Number.isFinite(z.low)).toBe(true);
      expect(Number.isFinite(z.high)).toBe(true);
      expect(z.low).toBeLessThanOrEqual(z.price);
      expect(z.high).toBeGreaterThanOrEqual(z.price);
    }
  });

  it("detects round number zone near 100", () => {
    const data = makeSwingCandles();
    const result = srZones(data, {
      includeSwingPoints: false,
      includePivotPoints: false,
      includeVwap: false,
      includeVolumeProfile: false,
      includeRoundNumbers: true,
    });

    const roundLevels = result.rawLevels.filter((l) => l.source === "round");
    expect(roundLevels.length).toBeGreaterThan(0);
    // Price range ~94-106 with interval 5 → expect round numbers at 95, 100, 105
    const prices = roundLevels.map((l) => l.price);
    expect(prices).toContain(100);
    // All round levels should be multiples of the interval (5)
    for (const p of prices) {
      expect(p % 5).toBe(0);
    }
  });

  it("includes custom levels in rawLevels", () => {
    const data = makeSwingCandles();
    const result = srZones(data, {
      includeSwingPoints: false,
      includePivotPoints: false,
      includeVwap: false,
      includeVolumeProfile: false,
      includeRoundNumbers: false,
      customLevels: [99.5, 101.5],
    });

    expect(result.rawLevels.length).toBe(2);
    expect(result.rawLevels[0].source).toBe("custom");
    expect(result.rawLevels[1].source).toBe("custom");
    expect(result.rawLevels[0].price).toBe(99.5);
    expect(result.rawLevels[1].price).toBe(101.5);
  });

  it("zones with more touches score higher than zones with fewer", () => {
    const data = makeSwingCandles();
    // Use many custom levels clustered at 100 and one at 105
    const result = srZones(data, {
      includeSwingPoints: false,
      includePivotPoints: false,
      includeVwap: false,
      includeVolumeProfile: false,
      includeRoundNumbers: false,
      customLevels: [100, 100.1, 99.9, 100.2, 99.8, 105],
      numZones: 2,
    });

    expect(result.zones.length).toBe(2);
    // The cluster near 100 has 5 levels, the one at 105 has 1
    const zone100 = result.zones.find((z) => Math.abs(z.price - 100) < 1);
    const zone105 = result.zones.find((z) => Math.abs(z.price - 105) < 1);
    expect(zone100).toBeDefined();
    expect(zone105).toBeDefined();
    expect(zone100!.touchCount).toBeGreaterThan(zone105!.touchCount);
    expect(zone100!.strength).toBeGreaterThan(zone105!.strength);
  });

  it("K-means convergence: zones are not NaN or Infinity", () => {
    const data = makeSwingCandles();
    const result = srZones(data, { maxIterations: 100 });

    for (const z of result.zones) {
      expect(Number.isNaN(z.price)).toBe(false);
      expect(Number.isNaN(z.low)).toBe(false);
      expect(Number.isNaN(z.high)).toBe(false);
      expect(Number.isFinite(z.price)).toBe(true);
      expect(Number.isFinite(z.strength)).toBe(true);
      expect(z.strength).toBeGreaterThanOrEqual(0);
      expect(z.strength).toBeLessThanOrEqual(100);
    }
  });

  it("zones are sorted by strength descending", () => {
    const data = makeSwingCandles();
    const result = srZones(data);

    for (let i = 1; i < result.zones.length; i++) {
      expect(result.zones[i - 1].strength).toBeGreaterThanOrEqual(result.zones[i].strength);
    }
  });

  it("sourceDiversity reflects number of unique source types", () => {
    const data = makeSwingCandles();
    const result = srZones(data, {
      includeSwingPoints: true,
      includePivotPoints: true,
      includeVwap: false,
      includeVolumeProfile: false,
      includeRoundNumbers: true,
      swingLookback: 3,
    });

    for (const z of result.zones) {
      expect(z.sourceDiversity).toBe(z.sources.length);
      expect(z.sourceDiversity).toBeGreaterThanOrEqual(1);
    }
  });
});
