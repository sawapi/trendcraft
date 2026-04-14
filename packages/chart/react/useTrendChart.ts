/**
 * React hook for @trendcraft/chart.
 *
 * Returns a `containerRef` to attach to a host element and a `chart`
 * state value that is `null` before mount and the live `ChartInstance`
 * after. Put `chart` in your effect dependencies to run imperative work
 * once the chart is ready.
 *
 * @example
 * ```tsx
 * import { useTrendChart } from '@trendcraft/chart/react';
 * import { connectIndicators } from '@trendcraft/chart';
 * import { indicatorPresets } from 'trendcraft';
 *
 * function MyChart() {
 *   const { containerRef, chart } = useTrendChart({ candles, theme: 'dark' });
 *
 *   useEffect(() => {
 *     if (!chart) return;
 *     const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
 *     conn.add('rsi');
 *     return () => conn.disconnect();
 *   }, [chart]);
 *
 *   return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
 * }
 * ```
 */

import { type RefObject, useEffect, useRef, useState } from "react";
import type {
  AnyPrimitivePlugin,
  AnySeriesRendererPlugin,
  PrimitivePlugin,
  SeriesRendererPlugin,
} from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartEvent,
  ChartInstance,
  ChartOptions,
  ChartPatternSignal,
  ChartType,
  CrosshairMoveData,
  DataPoint,
  Drawing,
  LayoutConfig,
  SeriesConfig,
  SeriesInfo,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../src/core/types";
import { createChart } from "../src/index";

export type IndicatorInput<T = unknown> = {
  data: DataPoint<T>[];
  config?: SeriesConfig;
};

export type UseTrendChartOptions = {
  candles: CandleData[];
  indicators?: (DataPoint<unknown>[] | IndicatorInput)[];
  signals?: SignalMarker[];
  trades?: TradeMarker[];
  drawings?: Drawing[];
  timeframes?: TimeframeOverlay[];
  backtest?: BacktestResultData;
  patterns?: ChartPatternSignal[];
  scores?: DataPoint<number | null>[];
  plugins?: {
    renderers?: AnySeriesRendererPlugin[];
    primitives?: AnyPrimitivePlugin[];
  };
  chartType?: ChartType;
  layout?: LayoutConfig;
  theme?: "dark" | "light" | ThemeColors;
  options?: Omit<ChartOptions, "theme">;
  fitOnLoad?: boolean;
  onCrosshairMove?: (data: CrosshairMoveData) => void;
  onSeriesAdded?: (data: SeriesInfo) => void;
  onSeriesRemoved?: (data: SeriesInfo) => void;
  onError?: (data: { source: string; error: unknown }) => void;
};

export type UseTrendChartResult = {
  /** Attach to the host element (`<div ref={containerRef} />`) */
  containerRef: RefObject<HTMLDivElement | null>;
  /** `null` before mount, `ChartInstance` after. Suitable for effect deps. */
  chart: ChartInstance | null;
};

export function useTrendChart(opts: UseTrendChartOptions): UseTrendChartResult {
  const {
    candles,
    indicators,
    signals,
    trades,
    drawings,
    timeframes,
    backtest,
    patterns,
    scores,
    plugins,
    chartType,
    layout,
    theme = "dark",
    options,
    fitOnLoad = true,
    onCrosshairMove,
    onSeriesAdded,
    onSeriesRemoved,
    onError,
  } = opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = useState<ChartInstance | null>(null);

  // Init chart — create on mount, destroy on unmount. `options`/`theme` only
  // feed the initial creation; runtime updates go through dedicated setters.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — chart recreation is expensive; runtime changes handled by separate effects
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = createChart(containerRef.current, { ...options, theme });
    setChart(instance);
    return () => {
      instance.destroy();
      setChart(null);
    };
  }, []);

  // Options — apply runtime-capable option changes after mount. Initial values
  // were already consumed at chart creation, so this is a no-op on the first
  // run but picks up any subsequent `options` prop change.
  useEffect(() => {
    if (!chart || !options) return;
    chart.applyOptions(options);
  }, [chart, options]);

  // Candles + fit
  useEffect(() => {
    if (!chart) return;
    chart.setCandles(candles);
    if (fitOnLoad) chart.fitContent();
  }, [chart, candles, fitOnLoad]);

  // Theme
  useEffect(() => {
    chart?.setTheme(theme);
  }, [chart, theme]);

  // Chart type
  useEffect(() => {
    if (chartType) chart?.setChartType(chartType);
  }, [chart, chartType]);

  // Layout
  useEffect(() => {
    if (layout) chart?.setLayout(layout);
  }, [chart, layout]);

  // Indicators
  useEffect(() => {
    if (!chart) return;
    const handles = (indicators ?? []).map((ind) => {
      if (Array.isArray(ind)) return chart.addIndicator(ind);
      return chart.addIndicator(ind.data, ind.config);
    });
    return () => {
      for (const h of handles) h.remove();
    };
  }, [chart, indicators]);

  // Signals
  useEffect(() => {
    if (signals) chart?.addSignals(signals);
  }, [chart, signals]);

  // Trades
  useEffect(() => {
    if (trades) chart?.addTrades(trades);
  }, [chart, trades]);

  // Drawings
  useEffect(() => {
    if (!chart || !drawings) return;
    for (const d of drawings) chart.addDrawing(d);
    return () => {
      for (const d of drawings) chart.removeDrawing(d.id);
    };
  }, [chart, drawings]);

  // Timeframes
  useEffect(() => {
    if (!chart || !timeframes) return;
    for (const tf of timeframes) chart.addTimeframe(tf);
    return () => {
      for (const tf of timeframes) chart.removeTimeframe(tf.id);
    };
  }, [chart, timeframes]);

  // Backtest
  useEffect(() => {
    if (backtest) chart?.addBacktest(backtest);
  }, [chart, backtest]);

  // Patterns
  useEffect(() => {
    if (patterns) chart?.addPatterns(patterns);
  }, [chart, patterns]);

  // Scores
  useEffect(() => {
    if (scores) chart?.addScores(scores);
  }, [chart, scores]);

  // Plugins
  useEffect(() => {
    if (!chart || !plugins) return;
    for (const r of plugins.renderers ?? []) chart.registerRenderer(r as SeriesRendererPlugin);
    for (const p of plugins.primitives ?? []) chart.registerPrimitive(p as PrimitivePlugin);
    return () => {
      for (const p of plugins.primitives ?? []) chart.removePrimitive(p.name);
    };
  }, [chart, plugins]);

  // Events — wrap typed callbacks to match ChartInstance.on() signature
  useEffect(() => {
    if (!chart) return;
    const handlers: Array<[ChartEvent, (data: unknown) => void]> = [];

    if (onCrosshairMove) {
      const h = (d: unknown) => onCrosshairMove(d as CrosshairMoveData);
      chart.on("crosshairMove", h);
      handlers.push(["crosshairMove", h]);
    }
    if (onSeriesAdded) {
      const h = (d: unknown) => onSeriesAdded(d as SeriesInfo);
      chart.on("seriesAdded", h);
      handlers.push(["seriesAdded", h]);
    }
    if (onSeriesRemoved) {
      const h = (d: unknown) => onSeriesRemoved(d as SeriesInfo);
      chart.on("seriesRemoved", h);
      handlers.push(["seriesRemoved", h]);
    }
    if (onError) {
      const h = (d: unknown) => onError(d as { source: string; error: unknown });
      chart.on("error", h);
      handlers.push(["error", h]);
    }

    return () => {
      for (const [event, handler] of handlers) chart.off(event, handler);
    };
  }, [chart, onCrosshairMove, onSeriesAdded, onSeriesRemoved, onError]);

  return { containerRef, chart };
}
