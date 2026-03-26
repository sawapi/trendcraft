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
import type { PrimitivePlugin, SeriesRendererPlugin } from "../src/core/plugin-types";
import type {
  CandleData,
  ChartInstance,
  ChartOptions,
  DataPoint,
  Drawing,
  LayoutConfig,
  SeriesConfig,
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
  backtest?: unknown;
  /** Pattern signals (trendcraft PatternSignal[] compatible) */
  patterns?: unknown[];
  /** Score heatmap data (0-100 per bar) */
  scores?: DataPoint<number | null>[];
  /** Custom plugins (series renderers and/or primitives) */
  plugins?: {
    renderers?: SeriesRendererPlugin<unknown>[];
    primitives?: PrimitivePlugin<unknown>[];
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
  onCrosshairMove?: (data: unknown) => void;
  /** Series added event handler */
  onSeriesAdded?: (data: unknown) => void;
  /** Series removed event handler */
  onSeriesRemoved?: (data: unknown) => void;
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

    for (const r of plugins.renderers ?? []) chart.registerRenderer(r);
    for (const p of plugins.primitives ?? []) chart.registerPrimitive(p);

    return () => {
      for (const p of plugins.primitives ?? []) chart.removePrimitive(p.name);
    };
  }, [plugins]);

  // Event: crosshairMove
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onCrosshairMove) return;
    chart.on("crosshairMove", onCrosshairMove);
    return () => chart.off("crosshairMove", onCrosshairMove);
  }, [onCrosshairMove]);

  // Event: seriesAdded
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onSeriesAdded) return;
    chart.on("seriesAdded", onSeriesAdded);
    return () => chart.off("seriesAdded", onSeriesAdded);
  }, [onSeriesAdded]);

  // Event: seriesRemoved
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onSeriesRemoved) return;
    chart.on("seriesRemoved", onSeriesRemoved);
    return () => chart.off("seriesRemoved", onSeriesRemoved);
  }, [onSeriesRemoved]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});

export default TrendChart;
