import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { getRegimeSizeMultiplier, regimeFilter } from "../conditions/presets";

const dummyCandle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

describe("regimeFilter", () => {
  it("should pass when no restrictions are set", () => {
    const filter = regimeFilter();
    const result = filter.evaluate(
      { regime: { volatility: "high", trend: "bearish", trendStrength: 10 } },
      dummyCandle,
    );
    expect(result).toBe(true);
  });

  it("should filter by allowed volatility levels", () => {
    const filter = regimeFilter({ allowedVolatility: ["low", "normal"] });
    expect(
      filter.evaluate(
        { regime: { volatility: "normal", trend: "bullish", trendStrength: 50 } },
        dummyCandle,
      ),
    ).toBe(true);
    expect(
      filter.evaluate(
        { regime: { volatility: "high", trend: "bullish", trendStrength: 50 } },
        dummyCandle,
      ),
    ).toBe(false);
  });

  it("should filter by allowed trend directions", () => {
    const filter = regimeFilter({ allowedTrends: ["bullish"] });
    expect(
      filter.evaluate(
        { regime: { volatility: "normal", trend: "bullish", trendStrength: 50 } },
        dummyCandle,
      ),
    ).toBe(true);
    expect(
      filter.evaluate(
        { regime: { volatility: "normal", trend: "bearish", trendStrength: 50 } },
        dummyCandle,
      ),
    ).toBe(false);
  });

  it("should filter by minimum trend strength", () => {
    const filter = regimeFilter({ minTrendStrength: 30 });
    expect(
      filter.evaluate(
        { regime: { volatility: "normal", trend: "bullish", trendStrength: 50 } },
        dummyCandle,
      ),
    ).toBe(true);
    expect(
      filter.evaluate(
        { regime: { volatility: "normal", trend: "sideways", trendStrength: 15 } },
        dummyCandle,
      ),
    ).toBe(false);
  });

  it("should return false when regime is not in snapshot", () => {
    const filter = regimeFilter();
    expect(filter.evaluate({}, dummyCandle)).toBe(false);
  });

  it("should use custom key", () => {
    const filter = regimeFilter({ key: "marketRegime" });
    expect(
      filter.evaluate(
        { marketRegime: { volatility: "low", trend: "bullish", trendStrength: 80 } },
        dummyCandle,
      ),
    ).toBe(true);
  });
});

describe("getRegimeSizeMultiplier", () => {
  it("should return default 1.0 when no regime in snapshot", () => {
    expect(getRegimeSizeMultiplier({})).toBe(1.0);
  });

  it("should return correct multiplier for each volatility level", () => {
    const multipliers = { low: 1.2, normal: 1.0, high: 0.5 };
    expect(getRegimeSizeMultiplier({ regime: { volatility: "low" } }, multipliers)).toBe(1.2);
    expect(getRegimeSizeMultiplier({ regime: { volatility: "normal" } }, multipliers)).toBe(1.0);
    expect(getRegimeSizeMultiplier({ regime: { volatility: "high" } }, multipliers)).toBe(0.5);
  });

  it("should use default high multiplier of 0.5", () => {
    expect(getRegimeSizeMultiplier({ regime: { volatility: "high" } })).toBe(0.5);
  });

  it("should use custom key", () => {
    expect(getRegimeSizeMultiplier({ mr: { volatility: "low" } }, { low: 1.5 }, "mr")).toBe(1.5);
  });
});
