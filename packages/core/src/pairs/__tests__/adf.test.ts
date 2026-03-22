import { describe, expect, it } from "vitest";
import { adfTest } from "../adf";

/** Simple seeded PRNG (mulberry32) for reproducible tests */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate normal-distributed random number using Box-Muller */
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

describe("adfTest (unit)", () => {
  it("strongly rejects unit root for highly stationary AR(0.3) series", () => {
    const rng = seededRandom(100);
    const n = 300;
    const series: number[] = [0];

    for (let i = 1; i < n; i++) {
      series.push(0.3 * series[i - 1] + normalRandom(rng));
    }

    const result = adfTest(series);

    // Should have a very negative t-statistic
    expect(result.adfStatistic).toBeLessThan(result.criticalValues["1%"]);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("respects custom maxLag", () => {
    const rng = seededRandom(200);
    const n = 200;
    const series: number[] = [0];
    for (let i = 1; i < n; i++) {
      series.push(0.5 * series[i - 1] + normalRandom(rng));
    }

    const result2 = adfTest(series, 2);
    const result5 = adfTest(series, 5);

    expect(result2.lag).toBe(2);
    expect(result5.lag).toBe(5);
    // Both should still detect stationarity
    expect(result2.adfStatistic).toBeLessThan(0);
    expect(result5.adfStatistic).toBeLessThan(0);
  });

  it("handles very short series gracefully", () => {
    const result = adfTest([1, 2, 3]);
    expect(result.pValue).toBe(1);
    expect(result.adfStatistic).toBe(0);
  });

  it("returns expected critical values structure", () => {
    const rng = seededRandom(300);
    const series: number[] = [0];
    for (let i = 1; i < 100; i++) {
      series.push(0.5 * series[i - 1] + normalRandom(rng));
    }

    const result = adfTest(series);

    expect(result.criticalValues).toHaveProperty("1%");
    expect(result.criticalValues).toHaveProperty("5%");
    expect(result.criticalValues).toHaveProperty("10%");
    // Critical values should be ordered: 1% < 5% < 10%
    expect(result.criticalValues["1%"]).toBeLessThan(result.criticalValues["5%"]);
    expect(result.criticalValues["5%"]).toBeLessThan(result.criticalValues["10%"]);
  });
});
