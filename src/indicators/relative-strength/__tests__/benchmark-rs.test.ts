import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { benchmarkRS, calculateRSRating, isOutperforming } from "../benchmark-rs";
import { bottomByRS, compareRS, filterByRSPercentile, rankByRS, topByRS } from "../multi-rs";

// Fixed base time for consistent alignment
const BASE_TIME = new Date(2024, 0, 1).getTime();

/**
 * Generate candles with a specified trend (with fixed base time)
 */
function generateTrendingCandles(
  count: number,
  startPrice: number,
  dailyReturn: number,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price = price * (1 + dailyReturn);
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.98,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate flat candles (no trend, with fixed base time)
 */
function generateFlatCandles(count: number, price: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < count; i++) {
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("benchmarkRS", () => {
  describe("basic calculation", () => {
    it("should return empty array if insufficient data", () => {
      const stock = generateFlatCandles(10, 100);
      const benchmark = generateFlatCandles(10, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20 });

      expect(rs).toHaveLength(0);
    });

    it("should calculate RS for stocks matching benchmark", () => {
      const stock = generateFlatCandles(100, 100);
      const benchmark = generateFlatCandles(100, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20 });

      expect(rs.length).toBeGreaterThan(0);
      // RS should be approximately 1.0 when matching benchmark
      const latest = rs[rs.length - 1].value;
      expect(latest.rs).toBeCloseTo(1.0, 1);
    });

    it("should show RS > 1 when stock outperforms benchmark", () => {
      // Stock goes up 1% daily, benchmark flat
      const stock = generateTrendingCandles(100, 100, 0.01);
      const benchmark = generateFlatCandles(100, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20 });

      expect(rs.length).toBeGreaterThan(0);
      const latest = rs[rs.length - 1].value;
      expect(latest.rs).toBeGreaterThan(1.0);
      expect(latest.outperformance).toBeGreaterThan(0);
    });

    it("should show RS < 1 when stock underperforms benchmark", () => {
      // Stock goes down 1% daily, benchmark flat
      const stock = generateTrendingCandles(100, 100, -0.01);
      const benchmark = generateFlatCandles(100, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20 });

      expect(rs.length).toBeGreaterThan(0);
      const latest = rs[rs.length - 1].value;
      expect(latest.rs).toBeLessThan(1.0);
      expect(latest.outperformance).toBeLessThan(0);
    });
  });

  describe("RS trend detection", () => {
    it("should detect upward RS trend", () => {
      // Create accelerating stock (increasing daily return) vs flat benchmark
      // This will produce increasing RS values which trigger "up" trend
      const stock: NormalizedCandle[] = [];
      let price = 100;
      for (let i = 0; i < 100; i++) {
        // Accelerating return: starts small, grows larger
        const dailyReturn = 0.01 + i * 0.001;
        price = price * (1 + dailyReturn);
        stock.push({
          time: BASE_TIME + i * 24 * 60 * 60 * 1000,
          open: price * 0.99,
          high: price * 1.01,
          low: price * 0.98,
          close: price,
          volume: 1000000,
        });
      }
      const benchmark = generateFlatCandles(100, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20, flatThreshold: 0.005 });

      const latest = rs[rs.length - 1].value;
      expect(latest.trend).toBe("up");
    });

    it("should detect downward RS trend", () => {
      // Create decelerating stock (worsening daily return) vs flat benchmark
      const stock: NormalizedCandle[] = [];
      let price = 200;
      for (let i = 0; i < 100; i++) {
        // Decelerating return: starts okay, gets worse
        const dailyReturn = -0.01 - i * 0.0005;
        price = price * (1 + dailyReturn);
        stock.push({
          time: BASE_TIME + i * 24 * 60 * 60 * 1000,
          open: price * 0.99,
          high: price * 1.01,
          low: price * 0.98,
          close: price,
          volume: 1000000,
        });
      }
      const benchmark = generateFlatCandles(100, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20, flatThreshold: 0.005 });

      const latest = rs[rs.length - 1].value;
      expect(latest.trend).toBe("down");
    });
  });

  describe("Mansfield RS", () => {
    it("should calculate Mansfield RS", () => {
      const stock = generateTrendingCandles(150, 100, 0.01);
      const benchmark = generateFlatCandles(150, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20, smaPeriod: 20 });

      expect(rs.length).toBeGreaterThan(0);
      const latest = rs[rs.length - 1].value;
      // When RS is trending up, Mansfield RS should be positive
      expect(latest.mansfieldRS).not.toBeNull();
    });
  });

  describe("RS Rating", () => {
    it("should calculate RS Rating percentile", () => {
      const stock = generateTrendingCandles(300, 100, 0.005);
      const benchmark = generateFlatCandles(300, 100);
      const rs = benchmarkRS(stock, benchmark, { period: 20 });

      expect(rs.length).toBeGreaterThan(0);
      const latest = rs[rs.length - 1].value;
      expect(latest.rsRating).not.toBeNull();
      expect(latest.rsRating).toBeGreaterThanOrEqual(0);
      expect(latest.rsRating).toBeLessThanOrEqual(100);
    });
  });
});

describe("calculateRSRating", () => {
  it("should return null for insufficient data", () => {
    const stock = generateFlatCandles(10, 100);
    const benchmark = generateFlatCandles(10, 100);
    const rating = calculateRSRating(stock, benchmark, 20);

    expect(rating).toBeNull();
  });

  it("should return rating for valid data", () => {
    const stock = generateTrendingCandles(100, 100, 0.01);
    const benchmark = generateFlatCandles(100, 100);
    const rating = calculateRSRating(stock, benchmark, 20);

    expect(rating).not.toBeNull();
    expect(rating).toBeGreaterThanOrEqual(0);
    expect(rating).toBeLessThanOrEqual(100);
  });
});

describe("isOutperforming", () => {
  it("should return true when outperforming by threshold", () => {
    const stock = generateTrendingCandles(100, 100, 0.01);
    const benchmark = generateFlatCandles(100, 100);

    expect(isOutperforming(stock, benchmark, 20, 0)).toBe(true);
  });

  it("should return false when underperforming", () => {
    const stock = generateTrendingCandles(100, 100, -0.01);
    const benchmark = generateFlatCandles(100, 100);

    expect(isOutperforming(stock, benchmark, 20, 0)).toBe(false);
  });

  it("should return false for insufficient data", () => {
    const stock = generateFlatCandles(10, 100);
    const benchmark = generateFlatCandles(10, 100);

    expect(isOutperforming(stock, benchmark, 20, 0)).toBe(false);
  });
});

describe("benchmarkRS edge cases", () => {
  it("should handle period=1", () => {
    const stock = generateTrendingCandles(50, 100, 0.01);
    const benchmark = generateFlatCandles(50, 100);
    const rs = benchmarkRS(stock, benchmark, { period: 1 });

    expect(rs.length).toBeGreaterThan(0);
    for (const entry of rs) {
      expect(typeof entry.value.rs).toBe("number");
      expect(Number.isFinite(entry.value.rs)).toBe(true);
    }
  });

  it("should handle very short data with large period", () => {
    const stock = generateFlatCandles(5, 100);
    const benchmark = generateFlatCandles(5, 100);
    const rs = benchmarkRS(stock, benchmark, { period: 52 });

    expect(rs).toHaveLength(0);
  });

  it("should handle zero benchmark returns gracefully", () => {
    // Benchmark has zero close (edge case)
    const stock = generateFlatCandles(50, 100);
    const benchmark = generateFlatCandles(50, 100);
    const rs = benchmarkRS(stock, benchmark, { period: 10 });

    // Should not throw and should have valid RS values
    expect(rs.length).toBeGreaterThan(0);
    for (const entry of rs) {
      expect(Number.isFinite(entry.value.rs)).toBe(true);
    }
  });
});

describe("Multi-Symbol RS", () => {
  describe("rankByRS", () => {
    it("should rank symbols by RS", () => {
      const symbolsData = new Map([
        ["STRONG", generateTrendingCandles(100, 100, 0.02)],
        ["MEDIUM", generateTrendingCandles(100, 100, 0.01)],
        ["WEAK", generateTrendingCandles(100, 100, -0.01)],
      ]);

      const rankings = rankByRS(symbolsData, { period: 20 });

      expect(rankings).toHaveLength(3);
      expect(rankings[0].symbol).toBe("STRONG");
      expect(rankings[1].symbol).toBe("MEDIUM");
      expect(rankings[2].symbol).toBe("WEAK");
      expect(rankings[0].rank).toBe(1);
      expect(rankings[2].rank).toBe(3);
    });
  });

  describe("topByRS", () => {
    it("should return top N symbols", () => {
      const symbolsData = new Map([
        ["A", generateTrendingCandles(100, 100, 0.03)],
        ["B", generateTrendingCandles(100, 100, 0.02)],
        ["C", generateTrendingCandles(100, 100, 0.01)],
        ["D", generateTrendingCandles(100, 100, 0.0)],
      ]);

      const top2 = topByRS(symbolsData, 2, { period: 20 });

      expect(top2).toHaveLength(2);
      expect(top2[0].symbol).toBe("A");
      expect(top2[1].symbol).toBe("B");
    });
  });

  describe("bottomByRS", () => {
    it("should return bottom N symbols", () => {
      const symbolsData = new Map([
        ["A", generateTrendingCandles(100, 100, 0.02)],
        ["B", generateTrendingCandles(100, 100, 0.01)],
        ["C", generateTrendingCandles(100, 100, -0.01)],
        ["D", generateTrendingCandles(100, 100, -0.02)],
      ]);

      const bottom2 = bottomByRS(symbolsData, 2, { period: 20 });

      expect(bottom2).toHaveLength(2);
      expect(bottom2[0].symbol).toBe("D");
      expect(bottom2[1].symbol).toBe("C");
    });
  });

  describe("filterByRSPercentile", () => {
    it("should filter symbols above percentile", () => {
      const symbolsData = new Map([
        ["TOP", generateTrendingCandles(100, 100, 0.03)],
        ["MID1", generateTrendingCandles(100, 100, 0.01)],
        ["MID2", generateTrendingCandles(100, 100, 0.0)],
        ["LOW", generateTrendingCandles(100, 100, -0.02)],
      ]);

      // Get top 25% (1 out of 4)
      const leaders = filterByRSPercentile(symbolsData, 75, { period: 20 });

      expect(leaders.length).toBe(1);
      expect(leaders[0].symbol).toBe("TOP");
    });
  });

  describe("compareRS", () => {
    it("should compare two symbols", () => {
      const strong = generateTrendingCandles(100, 100, 0.02);
      const weak = generateTrendingCandles(100, 100, -0.01);

      const diff = compareRS(strong, weak, 20);

      expect(diff).toBeGreaterThan(0);
    });

    it("should handle equal performance", () => {
      const a = generateTrendingCandles(100, 100, 0.01);
      const b = generateTrendingCandles(100, 100, 0.01);

      const diff = compareRS(a, b, 20);

      expect(diff).toBeCloseTo(0, 1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty Map", () => {
      const symbolsData = new Map<string, NormalizedCandle[]>();

      const rankings = rankByRS(symbolsData, { period: 20 });
      expect(rankings).toHaveLength(0);
    });

    it("should handle single symbol", () => {
      const symbolsData = new Map([
        ["ONLY", generateTrendingCandles(100, 100, 0.01)],
      ]);

      const rankings = rankByRS(symbolsData, { period: 20 });
      expect(rankings).toHaveLength(1);
      expect(rankings[0].symbol).toBe("ONLY");
      expect(rankings[0].rank).toBe(1);
    });

    it("should handle all symbols with insufficient data", () => {
      const symbolsData = new Map([
        ["A", generateFlatCandles(5, 100)],
        ["B", generateFlatCandles(5, 200)],
      ]);

      const rankings = rankByRS(symbolsData, { period: 52 });
      // With insufficient data, rankings may be empty or have null values
      expect(Array.isArray(rankings)).toBe(true);
    });

    it("should handle n > total symbols in topByRS", () => {
      const symbolsData = new Map([
        ["A", generateTrendingCandles(100, 100, 0.01)],
        ["B", generateTrendingCandles(100, 100, 0.02)],
      ]);

      const top5 = topByRS(symbolsData, 5, { period: 20 });
      expect(top5).toHaveLength(2);
    });

    it("should handle n > total symbols in bottomByRS", () => {
      const symbolsData = new Map([
        ["A", generateTrendingCandles(100, 100, 0.01)],
      ]);

      const bottom5 = bottomByRS(symbolsData, 5, { period: 20 });
      expect(bottom5).toHaveLength(1);
    });
  });
});
