/**
 * React wrapper for @trendcraft/chart.
 *
 * @example
 * ```tsx
 * import { TrendChart } from '@trendcraft/chart/react';
 * import { sma, rsi, runBacktest, goldenCrossCondition, rsiBelow } from 'trendcraft';
 *
 * <TrendChart
 *   candles={candles}
 *   indicators={[sma(candles, { period: 20 }), rsi(candles)]}
 *   backtest={runBacktest(candles, goldenCrossCondition(), rsiBelow(70), { capital: 100000 })}
 *   theme="dark"
 * />
 * ```
 */

import { type CSSProperties, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  AnyPrimitivePlugin,
  AnySeriesRendererPlugin,
  PrimitivePlugin,
  SeriesRendererPlugin,
} from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartInstance,
  ChartOptions,
  ChartPatternSignal,
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

export type TrendChartProps = {
  /** OHLCV candle data */
  candles: CandleData[];
  /** Indicator series to display */
  indicators?: (DataPoint<unknown>[] | IndicatorInput)[];
  /** Signal markers */
  signals?: SignalMarker[];
  /** Trade markers */
  trades?: TradeMarker[];
  /** Drawing elements (hline, trendline, fibonacci) */
  drawings?: Drawing[];
  /** Multi-timeframe overlays */
  timeframes?: TimeframeOverlay[];
  /** Backtest result (trendcraft BacktestResult compatible) */
  backtest?: BacktestResultData;
  /** Pattern signals (trendcraft PatternSignal[] compatible) */
  patterns?: ChartPatternSignal[];
  /** Score heatmap data (0-100 per bar) */
  scores?: DataPoint<number | null>[];
  /** Custom plugins (series renderers and/or primitives) */
  plugins?: {
    renderers?: AnySeriesRendererPlugin[];
    primitives?: AnyPrimitivePlugin[];
  };
  /** Base chart type (default: 'candlestick') */
  chartType?: import("../src/core/types").ChartType;
  /** Layout configuration */
  layout?: LayoutConfig;
  /** Theme: 'dark', 'light', or custom ThemeColors */
  theme?: "dark" | "light" | ThemeColors;
  /** Chart options (width, height, fontSize, watermark, etc.) */
  options?: Omit<ChartOptions, "theme">;
  /** Container CSS style */
  style?: CSSProperties;
  /** Container CSS class */
  className?: string;
  /** Fit all candles on initial render (default: true) */
  fitOnLoad?: boolean;
  /** Crosshair move event handler */
  onCrosshairMove?: (data: CrosshairMoveData) => void;
  /** Series added event handler */
  onSeriesAdded?: (data: SeriesInfo) => void;
  /** Series removed event handler */
  onSeriesRemoved?: (data: SeriesInfo) => void;
  /** Error event handler (e.g. plugin rendering failures) */
  onError?: (data: { source: string; error: unknown }) => void;
};

export type TrendChartRef = {
  /** Access the underlying ChartInstance */
  chart: ChartInstance | null;
};

export const TrendChart = forwardRef<TrendChartRef, TrendChartProps>(function TrendChart(
  {
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
    style,
    className,
    fitOnLoad = true,
    onCrosshairMove,
    onSeriesAdded,
    onSeriesRemoved,
    onError,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  // Expose chart instance via ref
  useImperativeHandle(ref, () => ({ chart: chartRef.current }), []);

  // Init chart — intentionally empty deps: only create/destroy on mount/unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: chart recreation is expensive; prop changes handled by separate effects
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, { ...options, theme });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  // Update candles
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setCandles(candles);
    if (fitOnLoad) chart.fitContent();
  }, [candles, fitOnLoad]);

  // Update theme
  useEffect(() => {
    chartRef.current?.setTheme(theme);
  }, [theme]);

  // Update chart type
  useEffect(() => {
    if (chartType) chartRef.current?.setChartType(chartType);
  }, [chartType]);

  // Update layout
  useEffect(() => {
    if (layout) chartRef.current?.setLayout(layout);
  }, [layout]);

  // Update indicators
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handles = (indicators ?? []).map((ind) => {
      if (Array.isArray(ind)) {
        return chart.addIndicator(ind);
      }
      return chart.addIndicator(ind.data, ind.config);
    });

    return () => {
      for (const h of handles) h.remove();
    };
  }, [indicators]);

  // Update signals
  useEffect(() => {
    if (signals) chartRef.current?.addSignals(signals);
  }, [signals]);

  // Update trades
  useEffect(() => {
    if (trades) chartRef.current?.addTrades(trades);
  }, [trades]);

  // Update drawings
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (drawings) {
      for (const d of drawings) chart.addDrawing(d);
    }

    return () => {
      if (drawings) {
        for (const d of drawings) chart.removeDrawing(d.id);
      }
    };
  }, [drawings]);

  // Update timeframes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (timeframes) {
      for (const tf of timeframes) chart.addTimeframe(tf);
    }

    return () => {
      if (timeframes) {
        for (const tf of timeframes) chart.removeTimeframe(tf.id);
      }
    };
  }, [timeframes]);

  // Update backtest
  useEffect(() => {
    if (backtest) chartRef.current?.addBacktest(backtest);
  }, [backtest]);

  // Update patterns
  useEffect(() => {
    if (patterns) chartRef.current?.addPatterns(patterns);
  }, [patterns]);

  // Update scores
  useEffect(() => {
    if (scores) chartRef.current?.addScores(scores);
  }, [scores]);

  // Update plugins
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !plugins) return;

    for (const r of plugins.renderers ?? []) chart.registerRenderer(r as SeriesRendererPlugin);
    for (const p of plugins.primitives ?? []) chart.registerPrimitive(p as PrimitivePlugin);

    return () => {
      for (const p of plugins.primitives ?? []) chart.removePrimitive(p.name);
    };
  }, [plugins]);

  // Event: crosshairMove
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onCrosshairMove) return;
    const handler = onCrosshairMove as (data: unknown) => void;
    chart.on("crosshairMove", handler);
    return () => chart.off("crosshairMove", handler);
  }, [onCrosshairMove]);

  // Event: seriesAdded
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onSeriesAdded) return;
    const handler = onSeriesAdded as (data: unknown) => void;
    chart.on("seriesAdded", handler);
    return () => chart.off("seriesAdded", handler);
  }, [onSeriesAdded]);

  // Event: seriesRemoved
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onSeriesRemoved) return;
    const handler = onSeriesRemoved as (data: unknown) => void;
    chart.on("seriesRemoved", handler);
    return () => chart.off("seriesRemoved", handler);
  }, [onSeriesRemoved]);

  // Event: error
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onError) return;
    const handler = onError as (data: unknown) => void;
    chart.on("error", handler);
    return () => chart.off("error", handler);
  }, [onError]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});
