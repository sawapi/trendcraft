import { describe, expect, it } from "vitest";
import type { ParameterOverride } from "../../strategy/template.js";
import { buildOverrideFromChanges, mergeOverride } from "../applier.js";
import type { AdjustParamsAction } from "../types.js";

describe("buildOverrideFromChanges", () => {
  it("builds override with indicator changes", () => {
    const changes: AdjustParamsAction["changes"] = {
      indicators: [{ type: "rsi", name: "rsi", params: { period: 10 } }],
    };

    const result = buildOverrideFromChanges("rsi-mean-reversion", changes, "shorten RSI period");

    expect(result.strategyId).toBe("rsi-mean-reversion");
    expect(result.overrides.indicators).toEqual([
      { type: "rsi", name: "rsi", params: { period: 10 } },
    ]);
    expect(result.reasoning).toBe("shorten RSI period");
    expect(result.appliedAt).toBeGreaterThan(0);
  });

  it("builds override with position changes", () => {
    const changes: AdjustParamsAction["changes"] = {
      position: { stopLoss: 5, takeProfit: 10 },
    };

    const result = buildOverrideFromChanges("macd-trend", changes, "widen stops");

    expect(result.overrides.position).toEqual({ stopLoss: 5, takeProfit: 10 });
    expect(result.overrides.indicators).toBeUndefined();
    expect(result.overrides.guards).toBeUndefined();
  });

  it("omits undefined change fields", () => {
    const changes: AdjustParamsAction["changes"] = {};

    const result = buildOverrideFromChanges("test-strategy", changes, "no changes");

    expect(result.overrides).toEqual({});
  });

  it("includes marketFilter when explicitly set to null", () => {
    const changes: AdjustParamsAction["changes"] = {
      marketFilter: null,
    };

    const result = buildOverrideFromChanges("test-strategy", changes, "clear market filter");

    expect(result.overrides.marketFilter).toBeNull();
    expect("marketFilter" in result.overrides).toBe(true);
  });
});

describe("mergeOverride", () => {
  it("appends new override to empty list", () => {
    const overrides: ParameterOverride[] = [];
    const override: ParameterOverride = {
      strategyId: "rsi-mean-reversion",
      overrides: { position: { stopLoss: 5 } },
      appliedAt: Date.now(),
      reasoning: "widen stop",
    };

    mergeOverride(overrides, override);

    expect(overrides).toHaveLength(1);
    expect(overrides[0].strategyId).toBe("rsi-mean-reversion");
  });

  it("merges with existing override for same strategy", () => {
    const overrides: ParameterOverride[] = [
      {
        strategyId: "rsi-mean-reversion",
        overrides: { position: { stopLoss: 3 } },
        appliedAt: 1000,
        reasoning: "initial change",
      },
    ];
    const override: ParameterOverride = {
      strategyId: "rsi-mean-reversion",
      overrides: { guards: { maxDailyTrades: 5 } },
      appliedAt: 2000,
      reasoning: "reduce trades",
    };

    mergeOverride(overrides, override);

    expect(overrides).toHaveLength(1);
    expect(overrides[0].overrides.position).toEqual({ stopLoss: 3 });
    expect(overrides[0].overrides.guards).toEqual({ maxDailyTrades: 5 });
    expect(overrides[0].appliedAt).toBe(2000);
  });

  it("merge combines overrides and concatenates reasoning", () => {
    const overrides: ParameterOverride[] = [
      {
        strategyId: "macd-trend",
        overrides: { position: { stopLoss: 2 } },
        appliedAt: 1000,
        reasoning: "tighten stop",
      },
    ];
    const override: ParameterOverride = {
      strategyId: "macd-trend",
      overrides: { position: { takeProfit: 8 } },
      appliedAt: 2000,
      reasoning: "increase target",
    };

    mergeOverride(overrides, override);

    expect(overrides[0].reasoning).toBe("tighten stop | increase target");
  });

  it("does not merge overrides for different strategies", () => {
    const overrides: ParameterOverride[] = [
      {
        strategyId: "rsi-mean-reversion",
        overrides: { position: { stopLoss: 3 } },
        appliedAt: 1000,
        reasoning: "first",
      },
    ];
    const override: ParameterOverride = {
      strategyId: "macd-trend",
      overrides: { position: { stopLoss: 5 } },
      appliedAt: 2000,
      reasoning: "second",
    };

    mergeOverride(overrides, override);

    expect(overrides).toHaveLength(2);
    expect(overrides[0].strategyId).toBe("rsi-mean-reversion");
    expect(overrides[1].strategyId).toBe("macd-trend");
  });
});
