import { describe, expect, it } from "vitest";
import { pbo, pboSafe } from "../pbo";

/** Deterministic seeded PRNG (mulberry32 — same pattern as the pairs tests). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** T×N matrix from a generator function. */
function matrix(rows: number, cols: number, fill: (t: number, n: number) => number): number[][] {
  return Array.from({ length: rows }, (_, t) => Array.from({ length: cols }, (_, n) => fill(t, n)));
}

describe("pbo (CSCV)", () => {
  it("reports ~0 for a configuration that dominates in every period", () => {
    const rand = seededRandom(42);
    // Column 0 always returns +1%, others are zero-mean noise
    const m = matrix(120, 10, (_t, n) => (n === 0 ? 0.01 : (rand() - 0.5) * 0.01));
    const result = pbo(m, { blocks: 10 });
    // The IS winner is always column 0, which also ranks best OOS
    expect(result.pbo).toBe(0);
    expect(result.combinations).toBe(252);
    expect(result.logits.length).toBe(252);
    expect(result.logits.every((l) => l > 0)).toBe(true);
  });

  it("reports 1 for a perfectly anti-persistent winner", () => {
    // Two configurations, two blocks: col 0 earns in block 0 and loses in
    // block 1, col 1 mirrored. Both CSCV splits (IS={0} and IS={1}) pick
    // a winner that is the OOS loser → PBO must be exactly 1. The wiggle
    // keeps each block's std positive so Sharpe is well-defined.
    const m = matrix(20, 2, (t, n) => {
      const inFirstBlock = t < 10;
      const wins = (n === 0) === inFirstBlock;
      const wiggle = t % 2 === 0 ? 0.002 : -0.002;
      return (wins ? 0.01 : -0.01) + wiggle;
    });
    const result = pbo(m, { blocks: 2 });
    expect(result.pbo).toBe(1);
    expect(result.combinations).toBe(2);
    expect(result.logits.every((l) => l <= 0)).toBe(true);
  });

  it("reports ~0.5 for pure noise (selection has no OOS information)", () => {
    const rand = seededRandom(7);
    const m = matrix(200, 8, () => (rand() - 0.5) * 0.02);
    const result = pbo(m, { blocks: 10 });
    // For i.i.d. noise the IS winner's OOS rank is uniform → PBO ≈ 0.5.
    // Allow a wide band — 252 splits over correlated subsets is not i.i.d.
    expect(result.pbo).toBeGreaterThan(0.2);
    expect(result.pbo).toBeLessThan(0.8);
  });

  it("treats an all-tied split as neutral, not overfit (PBO 0, not 1)", () => {
    // Every configuration earns the same constant return every period, so
    // every IS/OOS split is fully tied. The IS winner is never strictly
    // below the OOS median → PBO must be 0. A strict-comparison ranking
    // would rank the winner last in the tie group and report PBO 1.
    const m = matrix(40, 5, () => 0.01);
    const result = pbo(m, { blocks: 4 });
    expect(result.pbo).toBe(0);
    // Fully-tied → winner sits at the median → logit 0
    expect(result.logits.every((l) => l === 0)).toBe(true);
  });

  it("does not penalize a winner tied with the field on flat/no-trade configs", () => {
    // One genuinely positive config plus four flat (zero-return) ones. The
    // positive config wins both IS and OOS, so PBO stays 0; the flat ties
    // among the losers must not distort the winner's rank.
    const m = matrix(40, 5, (t, n) => (n === 0 ? (t % 2 === 0 ? 0.02 : 0.01) : 0));
    const result = pbo(m, { blocks: 4 });
    expect(result.pbo).toBe(0);
  });

  it("drops the tail remainder so blocks stay equal-sized", () => {
    const m = matrix(47, 3, (t, n) => ((t + n) % 3 === 0 ? 0.01 : -0.005));
    const result = pbo(m, { blocks: 4 });
    // 47 rows / 4 blocks → blockSize 11 → 44 rows used
    expect(result.observationsUsed).toBe(44);
    expect(result.blocks).toBe(4);
    expect(result.trials).toBe(3);
  });

  it("supports a custom ranking metric", () => {
    // Rank by total return instead of Sharpe: column 1 has huge variance
    // but the highest sum, so it must win under the custom metric
    const m = matrix(40, 2, (t, n) => {
      if (n === 0) return 0.001; // steady tiny gain (best Sharpe)
      return t % 2 === 0 ? 0.1 : -0.05; // volatile but higher total
    });
    const total = (returns: number[]) => returns.reduce((a, b) => a + b, 0);
    const result = pbo(m, { blocks: 4, metric: total });
    // Column 1 dominates on total return in every block → never overfit
    expect(result.pbo).toBe(0);
  });

  it("validates inputs", () => {
    const good = matrix(20, 2, () => 0.01);
    expect(() => pbo(good, { blocks: 3 })).toThrow(/even integer/);
    expect(() => pbo(good, { blocks: 22 })).toThrow(/<= 20/);
    expect(() =>
      pbo(
        matrix(4, 2, () => 0),
        { blocks: 10 },
      ),
    ).toThrow(/at least 10 observations/);
    expect(() =>
      pbo(
        matrix(20, 1, () => 0),
        { blocks: 4 },
      ),
    ).toThrow(/at least 2 strategy/);
    const ragged = [
      [1, 2],
      [1, 2, 3],
    ];
    expect(() => pbo(ragged, { blocks: 2 })).toThrow(/ragged/);
  });

  it("tolerates a ragged trailing row that the tail-drop discards", () => {
    // 9 rows / 4 blocks → blockSize 2 → 8 used, row 8 dropped. A malformed
    // trailing row must not be rejected, since it never enters the analysis.
    const m: number[][] = matrix(8, 2, (t, n) => (n === 0 ? 0.01 : t % 2 === 0 ? 0.02 : -0.01));
    m.push([0.5]); // ragged, length 1 — but it's the dropped remainder
    const result = pbo(m, { blocks: 4 });
    expect(result.observationsUsed).toBe(8);
    expect(result.trials).toBe(2);
  });

  it("still rejects a ragged row within the used range", () => {
    const m: number[][] = matrix(8, 2, () => 0.01);
    m[3] = [0.01]; // row 3 is inside the used range → genuine error
    expect(() => pbo(m, { blocks: 4 })).toThrow(/ragged/);
  });

  it("pboSafe returns Result instead of throwing", () => {
    const bad = pboSafe(
      matrix(4, 2, () => 0),
      { blocks: 10 },
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INSUFFICIENT_DATA");

    const rand = seededRandom(1);
    const good = pboSafe(
      matrix(50, 4, () => rand() - 0.5),
      { blocks: 10 },
    );
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.combinations).toBe(252);
  });
});
