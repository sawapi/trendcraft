import type { Trade } from "trendcraft";
import { describe, expect, it } from "vitest";
import { classifyKellySample, deriveKellyStats, recommendedKellyFraction } from "../risk";

function tradeAt(returnPercent: number, i = 0): Trade {
  return {
    entryTime: i,
    entryPrice: 100,
    exitTime: i + 1,
    exitPrice: 100 + returnPercent,
    return: returnPercent,
    returnPercent,
    holdingDays: 1,
  };
}

function manyTrades(wins: number, losses: number, winPct: number, lossPct: number): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < wins; i++) out.push(tradeAt(winPct, i));
  for (let i = 0; i < losses; i++) out.push(tradeAt(-lossPct, wins + i));
  return out;
}

describe("deriveKellyStats", () => {
  it("returns null for empty trade list", () => {
    expect(deriveKellyStats([])).toBeNull();
  });

  it("returns null when no decided (non-zero) trades exist", () => {
    expect(deriveKellyStats([tradeAt(0), tradeAt(0)])).toBeNull();
  });

  it("computes Kelly fraction f* = p - (1-p)/b on a clean 60% / 2:1 sample", () => {
    // 6 wins of +2%, 4 losses of -1% → p=0.6, b=2 → f* = 0.6 - 0.4/2 = 0.4
    const stats = deriveKellyStats(manyTrades(6, 4, 2, 1));
    expect(stats).not.toBeNull();
    if (!stats) return;
    expect(stats.winRate).toBeCloseTo(0.6, 6);
    expect(stats.winLossRatio).toBeCloseTo(2, 6);
    expect(stats.kellyStar).toBeCloseTo(0.4, 6);
    expect(stats.sampleSize).toBe(10);
  });

  it("clips negative Kelly to 0", () => {
    // 3 wins of +1%, 7 losses of -2% → p=0.3, b=0.5 → f* = 0.3 - 0.7/0.5 = -1.1 → 0
    const stats = deriveKellyStats(manyTrades(3, 7, 1, 2));
    if (!stats) throw new Error("expected stats");
    expect(stats.kellyStar).toBe(0);
  });

  it("returns null CI when there are fewer than 2 wins or fewer than 2 losses", () => {
    const stats = deriveKellyStats(manyTrades(1, 5, 2, 1));
    if (!stats) throw new Error("expected stats");
    expect(stats.stdError).toBeNull();
    expect(stats.ci95).toBeNull();
  });

  it("computes a finite, non-negative 95% CI when both sides have variance", () => {
    // Introduce dispersion so sample variance is positive
    const trades: Trade[] = [
      tradeAt(2.0, 0),
      tradeAt(3.0, 1),
      tradeAt(2.5, 2),
      tradeAt(1.5, 3),
      tradeAt(2.2, 4),
      tradeAt(2.8, 5),
      tradeAt(-1.0, 6),
      tradeAt(-1.5, 7),
      tradeAt(-0.8, 8),
      tradeAt(-1.2, 9),
    ];
    const stats = deriveKellyStats(trades);
    if (!stats) throw new Error("expected stats");
    if (!stats.stdError || !stats.ci95) throw new Error("expected CI");
    expect(stats.stdError).toBeGreaterThan(0);
    expect(stats.ci95.low).toBeLessThanOrEqual(stats.kellyStar);
    expect(stats.ci95.high).toBeGreaterThanOrEqual(stats.kellyStar);
    // Sanity: CI half-width is ~1.96 * stdError
    const halfWidth = (stats.ci95.high - stats.ci95.low) / 2;
    expect(halfWidth).toBeCloseTo(1.96 * stats.stdError, 6);
  });
});

describe("classifyKellySample", () => {
  it("flags <30 as insufficient", () => {
    expect(classifyKellySample(0)).toBe("insufficient");
    expect(classifyKellySample(29)).toBe("insufficient");
  });
  it("flags 30..99 as limited", () => {
    expect(classifyKellySample(30)).toBe("limited");
    expect(classifyKellySample(99)).toBe("limited");
  });
  it("flags ≥100 as acceptable", () => {
    expect(classifyKellySample(100)).toBe("acceptable");
    expect(classifyKellySample(500)).toBe("acceptable");
  });
});

describe("recommendedKellyFraction", () => {
  it("returns Quarter Kelly below 100 trades", () => {
    expect(recommendedKellyFraction(20)).toBe(0.25);
    expect(recommendedKellyFraction(99)).toBe(0.25);
  });
  it("returns Half Kelly at 100+ trades", () => {
    expect(recommendedKellyFraction(100)).toBe(0.5);
    expect(recommendedKellyFraction(500)).toBe(0.5);
  });
});
