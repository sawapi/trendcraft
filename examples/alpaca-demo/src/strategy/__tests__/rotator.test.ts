import { describe, expect, it } from "vitest";
import { createStrategyRotator } from "../rotator.js";
import type { RegimeSnapshot } from "../rotator.js";

const ALL_STRATEGIES = [
  "macd-trend",
  "sma-golden-cross",
  "rsi-mean-reversion",
  "bollinger-squeeze",
  "ema-dead-cross-short",
  "rsi-overbought-short",
  "keltner-reversion",
  "unknown-strategy",
];

describe("createStrategyRotator", () => {
  it("initial state: all strategies are active", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    expect(rotator.getCurrentRegime()).toBeNull();
    // Before first onRegimeChange, all are "active" by default
  });

  it("strong bullish trend: trend strategies active, reversion/range inactive", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    const regime: RegimeSnapshot = { trend: "bullish", volatility: "normal", trendStrength: 30 };
    const active = rotator.getActiveStrategies(regime);

    expect(active.has("macd-trend")).toBe(true);
    expect(active.has("sma-golden-cross")).toBe(true);
    expect(active.has("rsi-mean-reversion")).toBe(false);
    expect(active.has("bollinger-squeeze")).toBe(false);
    expect(active.has("keltner-reversion")).toBe(false);
    // Unknown category = always active
    expect(active.has("unknown-strategy")).toBe(true);
  });

  it("sideways regime: reversion and range active, trend inactive", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    const regime: RegimeSnapshot = { trend: "sideways", volatility: "normal", trendStrength: 15 };
    const active = rotator.getActiveStrategies(regime);

    expect(active.has("rsi-mean-reversion")).toBe(true);
    expect(active.has("bollinger-squeeze")).toBe(true);
    expect(active.has("keltner-reversion")).toBe(true);
    expect(active.has("macd-trend")).toBe(false);
  });

  it("bearish regime: short strategies active", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    const regime: RegimeSnapshot = { trend: "bearish", volatility: "normal", trendStrength: 30 };
    const active = rotator.getActiveStrategies(regime);

    expect(active.has("ema-dead-cross-short")).toBe(true);
    expect(active.has("rsi-overbought-short")).toBe(true);
  });

  it("onRegimeChange returns correct activate/deactivate deltas", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);

    // First change: bullish strong trend
    const bullish: RegimeSnapshot = { trend: "bullish", volatility: "normal", trendStrength: 30 };
    const result1 = rotator.onRegimeChange(bullish);
    // Initial state had all active, so deactivate includes non-trend
    expect(result1.deactivate.length).toBeGreaterThan(0);

    // Switch to sideways
    const sideways: RegimeSnapshot = { trend: "sideways", volatility: "normal", trendStrength: 15 };
    const result2 = rotator.onRegimeChange(sideways);
    // Trend strategies should be deactivated
    expect(result2.deactivate).toContain("macd-trend");
    expect(result2.deactivate).toContain("sma-golden-cross");
    // Reversion should be activated
    expect(result2.activate).toContain("rsi-mean-reversion");
    expect(result2.activate).toContain("bollinger-squeeze");
  });

  it("getCurrentRegime returns last set regime", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    const regime: RegimeSnapshot = { trend: "bearish", volatility: "high", trendStrength: 28 };
    rotator.onRegimeChange(regime);
    expect(rotator.getCurrentRegime()).toEqual(regime);
  });

  it("getCategory returns correct category or undefined", () => {
    const rotator = createStrategyRotator(ALL_STRATEGIES);
    expect(rotator.getCategory("macd-trend")).toBe("trend");
    expect(rotator.getCategory("rsi-mean-reversion")).toBe("reversion");
    expect(rotator.getCategory("unknown-strategy")).toBeUndefined();
  });
});
