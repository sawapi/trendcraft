/**
 * Vue Wrapper Tests
 *
 * Tests the Vue TrendChart component's module structure and type safety
 * without requiring a DOM environment. Full rendering tests (mount/unmount/
 * prop updates) require jsdom and are planned for P2.
 */

import { describe, expect, it } from "vitest";
import { TrendChart } from "../../vue/TrendChart";

describe("Vue TrendChart wrapper", () => {
  it("is a valid Vue component definition", () => {
    expect(TrendChart).toBeDefined();
    // defineComponent returns an object with name, props, setup, emits
    expect(typeof TrendChart).toBe("object");
    expect((TrendChart as Record<string, unknown>).name).toBe("TrendChart");
  });

  it("declares expected props", () => {
    const props = (TrendChart as Record<string, unknown>).props as Record<string, unknown>;
    expect(props).toBeDefined();
    expect(props.candles).toBeDefined();
    expect(props.indicators).toBeDefined();
    expect(props.signals).toBeDefined();
    expect(props.trades).toBeDefined();
    expect(props.drawings).toBeDefined();
    expect(props.timeframes).toBeDefined();
    expect(props.backtest).toBeDefined();
    expect(props.patterns).toBeDefined();
    expect(props.scores).toBeDefined();
    expect(props.plugins).toBeDefined();
    expect(props.chartType).toBeDefined();
    expect(props.layout).toBeDefined();
    expect(props.theme).toBeDefined();
    expect(props.options).toBeDefined();
    expect(props.fitOnLoad).toBeDefined();
  });

  it("declares expected emits", () => {
    const emits = (TrendChart as Record<string, unknown>).emits as string[];
    expect(emits).toBeDefined();
    expect(emits).toContain("crosshairMove");
    expect(emits).toContain("seriesAdded");
    expect(emits).toContain("seriesRemoved");
    expect(emits).toContain("error");
  });

  it("has a setup function", () => {
    expect((TrendChart as Record<string, unknown>).setup).toBeDefined();
    expect(typeof (TrendChart as Record<string, unknown>).setup).toBe("function");
  });
});
