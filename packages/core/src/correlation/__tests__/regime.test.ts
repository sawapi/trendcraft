import { describe, expect, it } from "vitest";
import type { CorrelationPoint } from "../../types/correlation";
import { detectCorrelationRegimes } from "../regime";

describe("detectCorrelationRegimes (unit)", () => {
  it("returns empty for empty input", () => {
    expect(detectCorrelationRegimes([])).toEqual([]);
  });

  it("returns duration 1 for a single point", () => {
    const series: CorrelationPoint[] = [{ time: 1, pearson: 0.5, spearman: 0.5 }];

    const result = detectCorrelationRegimes(series);
    expect(result).toHaveLength(1);
    expect(result[0].regimeDuration).toBe(1);
    expect(result[0].regime).toBe("positive");
  });

  it("increases duration for same regime", () => {
    const series: CorrelationPoint[] = [
      { time: 1, pearson: 0.8, spearman: 0.8 },
      { time: 2, pearson: 0.85, spearman: 0.85 },
      { time: 3, pearson: 0.9, spearman: 0.9 },
      { time: 4, pearson: 0.75, spearman: 0.75 },
      { time: 5, pearson: 0.95, spearman: 0.95 },
    ];

    const result = detectCorrelationRegimes(series);

    // All should be strong_positive (>= 0.7)
    for (const r of result) {
      expect(r.regime).toBe("strong_positive");
    }

    expect(result[0].regimeDuration).toBe(1);
    expect(result[1].regimeDuration).toBe(2);
    expect(result[2].regimeDuration).toBe(3);
    expect(result[3].regimeDuration).toBe(4);
    expect(result[4].regimeDuration).toBe(5);
  });

  it("resets duration on regime change", () => {
    const series: CorrelationPoint[] = [
      { time: 1, pearson: 0.8, spearman: 0.8 },
      { time: 2, pearson: 0.9, spearman: 0.9 },
      { time: 3, pearson: 0.0, spearman: 0.0 }, // neutral
      { time: 4, pearson: 0.1, spearman: 0.1 }, // still neutral
    ];

    const result = detectCorrelationRegimes(series);

    expect(result[0].regime).toBe("strong_positive");
    expect(result[1].regimeDuration).toBe(2);
    expect(result[2].regime).toBe("neutral");
    expect(result[2].regimeDuration).toBe(1);
    expect(result[3].regime).toBe("neutral");
    expect(result[3].regimeDuration).toBe(2);
  });

  it("preserves correlation value in output", () => {
    const series: CorrelationPoint[] = [{ time: 1, pearson: -0.85, spearman: -0.85 }];

    const result = detectCorrelationRegimes(series);
    expect(result[0].correlation).toBe(-0.85);
    expect(result[0].regime).toBe("strong_negative");
  });
});
