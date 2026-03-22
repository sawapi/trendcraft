import { describe, expect, it } from "vitest";
import { analyzeLeadLag } from "../lead-lag";

/** Seeded PRNG */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("analyzeLeadLag (unit)", () => {
  it("detects B leading A (negative optimal lag)", () => {
    const rng = seededRandom(42);
    const n = 300;
    const lag = 3;
    const returnsB: number[] = [];

    for (let i = 0; i < n; i++) {
      returnsB.push((rng() - 0.5) * 0.04);
    }

    // A follows B with a lag of 3
    const returnsA: number[] = new Array(n).fill(0);
    for (let i = lag; i < n; i++) {
      returnsA[i] = returnsB[i - lag] * 0.9 + (rng() - 0.5) * 0.002;
    }

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
    expect(result.optimalLag).toBe(-lag);
    expect(result.maxCorrelation).toBeGreaterThan(0.5);
    expect(result.assessment).toContain("Asset B leads");
  });

  it("returns 'No significant' for uncorrelated series", () => {
    const rng = seededRandom(99);
    const n = 200;
    const returnsA: number[] = [];
    const returnsB: number[] = [];

    for (let i = 0; i < n; i++) {
      returnsA.push((rng() - 0.5) * 0.04);
      returnsB.push((rng() - 0.5) * 0.04);
    }

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
    expect(result.assessment).toContain("No significant");
  });

  it("handles maxLag=0", () => {
    const rng = seededRandom(55);
    const n = 100;
    const returnsA: number[] = [];
    const returnsB: number[] = [];

    for (let i = 0; i < n; i++) {
      const r = (rng() - 0.5) * 0.04;
      returnsA.push(r);
      returnsB.push(r * 0.9 + (rng() - 0.5) * 0.002);
    }

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 0 });
    // Only lag 0 tested
    expect(result.crossCorrelation).toHaveLength(1);
    expect(result.crossCorrelation[0].lag + 0).toBe(0);
    expect(result.optimalLag + 0).toBe(0);
  });
});
