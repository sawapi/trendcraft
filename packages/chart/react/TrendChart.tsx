/**
 * React wrapper for @trendcraft/chart.
 *
 * @example
 * ```tsx
 * import { TrendChart } from '@trendcraft/chart/react';
 * import { sma, rsi } from 'trendcraft';
 *
 * <TrendChart
 *   candles={candles}
 *   indicators={[sma(candles, { period: 20 }), rsi(candles)]}
 *   theme="dark"
 * />
 * ```
 */

import { type CSSProperties, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  CandleData,
  ChartInstance,
  ChartOptions,
  DataPoint,
  LayoutConfig,
  SeriesConfig,
  SignalMarker,
  ThemeColors,
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
  /** Layout configuration */
  layout?: LayoutConfig;
  /** Theme: 'dark', 'light', or custom ThemeColors */
  theme?: "dark" | "light" | ThemeColors;
  /** Chart options (width, height, fontSize, etc.) */
  options?: Omit<ChartOptions, "theme">;
  /** Container CSS style */
  style?: CSSProperties;
  /** Container CSS class */
  className?: string;
  /** Fit all candles on initial render (default: true) */
  fitOnLoad?: boolean;
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
    layout,
    theme = "dark",
    options,
    style,
    className,
    fitOnLoad = true,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  // Expose chart instance via ref
  useImperativeHandle(ref, () => ({ chart: chartRef.current }), []);

  // Init chart — intentionally empty deps: only create/destroy on mount/unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: chart recreation is expensive; theme/options changes handled by separate effects
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

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});

export default TrendChart;
