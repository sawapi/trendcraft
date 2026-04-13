/**
 * React Wrapper Tests
 *
 * Tests the React TrendChart component's module structure and type safety
 * without requiring a DOM environment. Full rendering tests (mount/unmount/
 * prop updates) require jsdom and are planned for P2.
 */

import { describe, expect, it } from "vitest";
import { TrendChart } from "../../react/TrendChart";
import type { TrendChartProps, TrendChartRef } from "../../react/TrendChart";

describe("React TrendChart wrapper", () => {
  it("is a valid React forwardRef component", () => {
    expect(TrendChart).toBeDefined();
    // forwardRef components have $$typeof and render properties
    expect((TrendChart as unknown as Record<string, unknown>).$$typeof).toBeDefined();
  });

  it("accepts expected prop types (compile-time check)", () => {
    // This test validates TypeScript compilation — if props are wrong, tsc would fail
    const _props: TrendChartProps = {
      candles: [{ time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 }],
    };
    expect(_props.candles).toHaveLength(1);
  });

  it("TrendChartRef type includes chart property", () => {
    // Compile-time type check
    const _ref: TrendChartRef = { chart: null };
    expect(_ref.chart).toBeNull();
  });

  it("accepts optional props without error", () => {
    const _fullProps: TrendChartProps = {
      candles: [],
      indicators: [],
      signals: [],
      trades: [],
      drawings: [],
      timeframes: [],
      backtest: undefined,
      patterns: [],
      scores: [],
      plugins: { renderers: [], primitives: [] },
      chartType: "candlestick",
      layout: undefined,
      theme: "dark",
      options: {},
      style: {},
      className: "test",
      fitOnLoad: true,
      onCrosshairMove: () => {},
      onSeriesAdded: () => {},
      onSeriesRemoved: () => {},
      onError: () => {},
    };
    expect(_fullProps).toBeDefined();
  });
});
