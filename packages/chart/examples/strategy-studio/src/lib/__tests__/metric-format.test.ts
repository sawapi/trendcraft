import { describe, expect, it } from "vitest";
import { formatMetric, metricScaler } from "../metric-format";

// A profit factor with no losing trade is Infinity, and with metric
// profitFactor it reaches optimization scores and sensitivity means.
const INF = Number.POSITIVE_INFINITY;

describe("formatMetric", () => {
  it("prints infinities as ∞ and NaN as a dash", () => {
    expect(formatMetric(INF, 2)).toBe("∞");
    expect(formatMetric(-INF, 2)).toBe("-∞");
    expect(formatMetric(Number.NaN, 2)).toBe("—");
    expect(formatMetric(1.234, 2)).toBe("1.23");
  });
});

describe("metricScaler", () => {
  it("scales by the finite range and puts Infinity at the top", () => {
    const scale = metricScaler([1, 3, INF]);
    expect(scale(1)).toBe(0);
    expect(scale(3)).toBe(1);
    // Scaling by a range reaching Infinity gave NaN here and 0 for every finite bar.
    expect(scale(INF)).toBe(1);
    expect(scale(-INF)).toBe(0);
  });

  it("keeps an all-Infinity row at the top rather than at 0", () => {
    const scale = metricScaler([INF, INF]);
    expect(scale(INF)).toBe(1);
  });
});
