/**
 * React wrapper component for @trendcraft/chart.
 *
 * Thin component built on top of the `useTrendChart` hook. Covers the
 * common case where you want to drop a chart into a JSX tree with a few
 * data props. For imperative control (connectIndicators, setDrawingTool,
 * custom plugins), use `useTrendChart` directly and operate on the
 * returned `chart` value.
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

import { type CSSProperties, forwardRef, useImperativeHandle } from "react";
import type { ChartInstance } from "../src/core/types";
import { type UseTrendChartOptions, useTrendChart } from "./useTrendChart";

export type { IndicatorInput, UseTrendChartOptions, UseTrendChartResult } from "./useTrendChart";
export { useTrendChart } from "./useTrendChart";

export type TrendChartProps = UseTrendChartOptions & {
  /** Container CSS style */
  style?: CSSProperties;
  /** Container CSS class */
  className?: string;
};

export type TrendChartRef = {
  /** Access the underlying ChartInstance */
  chart: ChartInstance | null;
};

export const TrendChart = forwardRef<TrendChartRef, TrendChartProps>(function TrendChart(
  { style, className, ...options },
  ref,
) {
  const { containerRef, chart } = useTrendChart(options);

  useImperativeHandle(ref, () => ({ chart }), [chart]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
});
