import { describe, expect, it } from "vitest";
import { detectIntermarketDivergence } from "../divergence";

describe("detectIntermarketDivergence (unit)", () => {
  it("returns empty for short series (n < 2 * lookback)", () => {
    const n = 30;
    const prices = Array.from({ length: n }, (_, i) => 100 + i);
    const times = Array.from({ length: n }, (_, i) => i);

    const result = detectIntermarketDivergence(prices, prices, times, {
      divergenceLookback: 20,
    });

    expect(result).toHaveLength(0);
  });

  it("detects bullish divergence when A falls and B rises", () => {
    const n = 200;
    const pricesA: number[] = [100];
    const pricesB: number[] = [100];
    const times: number[] = [0];

    // First 80 bars: co-move
    for (let i = 1; i < 80; i++) {
      pricesA.push(pricesA[i - 1] + 0.1);
      pricesB.push(pricesB[i - 1] + 0.1);
      times.push(i);
    }

    // Next 120 bars: A goes down, B goes up (divergence)
    for (let i = 80; i < n; i++) {
      pricesA.push(pricesA[i - 1] * 0.99); // A falls
      pricesB.push(pricesB[i - 1] * 1.01); // B rises
      times.push(i);
    }

    const divs = detectIntermarketDivergence(pricesA, pricesB, times, {
      divergenceLookback: 20,
      divergenceThreshold: 2.0,
    });

    // B outperforming A → bullish divergence for A
    const bullish = divs.filter((d) => d.type === "bullish");
    expect(bullish.length).toBeGreaterThan(0);
  });

  it("returns empty when threshold is very high", () => {
    const n = 200;
    const pricesA: number[] = [100];
    const pricesB: number[] = [100];
    const times: number[] = [0];

    for (let i = 1; i < n; i++) {
      pricesA.push(pricesA[i - 1] * 1.01);
      pricesB.push(pricesB[i - 1] * 0.99);
      times.push(i);
    }

    const divs = detectIntermarketDivergence(pricesA, pricesB, times, {
      divergenceLookback: 20,
      divergenceThreshold: 100, // Impossibly high threshold
    });

    expect(divs).toHaveLength(0);
  });

  it("each divergence has required fields", () => {
    const n = 200;
    const pricesA: number[] = [100];
    const pricesB: number[] = [100];
    const times: number[] = [0];

    for (let i = 1; i < 80; i++) {
      pricesA.push(pricesA[i - 1] + 0.1);
      pricesB.push(pricesB[i - 1] + 0.1);
      times.push(i);
    }
    for (let i = 80; i < n; i++) {
      pricesA.push(pricesA[i - 1] * 1.02);
      pricesB.push(pricesB[i - 1] * 0.98);
      times.push(i);
    }

    const divs = detectIntermarketDivergence(pricesA, pricesB, times, {
      divergenceLookback: 20,
      divergenceThreshold: 2.0,
    });

    for (const d of divs) {
      expect(d).toHaveProperty("time");
      expect(d).toHaveProperty("type");
      expect(["bullish", "bearish"]).toContain(d.type);
      expect(typeof d.returnA).toBe("number");
      expect(typeof d.returnB).toBe("number");
      expect(typeof d.returnSpread).toBe("number");
      expect(d.significance).toBeGreaterThanOrEqual(2.0);
    }
  });
});
