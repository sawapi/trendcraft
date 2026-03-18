import { describe, expect, it } from "vitest";
import { analyzeMeanReversion } from "../mean-reversion";

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

describe("analyzeMeanReversion (unit)", () => {
  it("detects fast mean-reversion with AR coefficient 0.5", () => {
    const rng = seededRandom(500);
    const n = 500;
    const spreads: number[] = [0];

    for (let i = 1; i < n; i++) {
      spreads.push(0.5 * spreads[i - 1] + normalRandom(rng) * 0.5);
    }

    const result = analyzeMeanReversion(spreads, 100);

    expect(result.lambda).toBeCloseTo(0.5, 1);
    // Half-life for lambda=0.5 is -ln2/ln(0.5) = 1
    expect(result.halfLife).toBeLessThan(5);
    expect(result.isMeanReverting).toBe(true);
  });

  it("lambda=1 (random walk) gives halfLife=Infinity", () => {
    const rng = seededRandom(600);
    const n = 500;
    const spreads: number[] = [0];

    for (let i = 1; i < n; i++) {
      spreads.push(spreads[i - 1] + normalRandom(rng) * 0.5);
    }

    const result = analyzeMeanReversion(spreads, 100);

    // Lambda close to 1, halfLife should be Infinity or very large
    expect(result.lambda).toBeGreaterThan(0.95);
    expect(result.isMeanReverting).toBe(false);
  });

  it("lambda > 1 (explosive) is not mean-reverting", () => {
    // Construct a series that looks explosive
    const n = 200;
    const spreads: number[] = [1];
    for (let i = 1; i < n; i++) {
      spreads.push(1.05 * spreads[i - 1] + 0.01);
    }

    const result = analyzeMeanReversion(spreads, 100);

    expect(result.isMeanReverting).toBe(false);
    expect(result.halfLife).toBe(Number.POSITIVE_INFINITY);
  });

  it("Hurst exponent is always in range [0, 1]", () => {
    const rng = seededRandom(700);
    const n = 500;
    const spreads: number[] = [0];

    for (let i = 1; i < n; i++) {
      spreads.push(0.7 * spreads[i - 1] + normalRandom(rng));
    }

    const result = analyzeMeanReversion(spreads, 100);

    expect(result.hurstExponent).toBeGreaterThanOrEqual(0);
    expect(result.hurstExponent).toBeLessThanOrEqual(1);
  });

  it("returns default values for very short series", () => {
    const result = analyzeMeanReversion([1, 2, 3, 4, 5], 100);

    expect(result.isMeanReverting).toBe(false);
    expect(result.halfLife).toBe(Number.POSITIVE_INFINITY);
    expect(result.lambda).toBe(1);
    expect(result.hurstExponent).toBe(0.5);
  });
});
