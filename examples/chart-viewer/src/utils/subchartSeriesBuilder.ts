/**
 * Subchart series builder for indicator subcharts (RSI, MACD, etc.)
 */

import type { IndicatorParams, SubChartType } from "../types";
import type { IndicatorData } from "../hooks/useIndicators";
import type { SeriesItem, SubchartContext } from "./chartColors";
import { buildMomentumSubcharts } from "./subchart/momentumSubcharts";
import { buildVolumeSubcharts } from "./subchart/volumeSubcharts";
import { buildOtherSubcharts } from "./subchart/otherSubcharts";

/**
 * Build subchart indicator series
 */
export function buildSubchartSeries(
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  indicatorParams?: IndicatorParams,
): SeriesItem[] {
  return [
    ...buildMomentumSubcharts(ctx, indicators, enabledIndicators, indicatorParams),
    ...buildVolumeSubcharts(ctx, indicators, enabledIndicators, indicatorParams),
    ...buildOtherSubcharts(ctx, indicators, enabledIndicators, indicatorParams),
  ];
}
