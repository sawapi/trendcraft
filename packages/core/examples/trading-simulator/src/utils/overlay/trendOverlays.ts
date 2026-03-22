import { COLORS, type SeriesItem, createLineSeries } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build trend overlay series (Ichimoku, Supertrend, Parabolic SAR)
 */
export function buildTrendOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // Ichimoku
  if (enabledIndicators.includes("ichimoku")) {
    if (indicators.ichimokuTenkan) {
      series.push(createLineSeries("Tenkan", indicators.ichimokuTenkan, COLORS.ichimokuTenkan));
    }
    if (indicators.ichimokuKijun) {
      series.push(createLineSeries("Kijun", indicators.ichimokuKijun, COLORS.ichimokuKijun));
    }
    if (indicators.ichimokuSenkouA && indicators.ichimokuSenkouB) {
      series.push({
        name: "Cloud",
        type: "line",
        data: indicators.ichimokuSenkouA,
        symbol: "none",
        lineStyle: { color: COLORS.ichimokuSenkouA, width: 1 },
        areaStyle: {
          color: COLORS.ichimokuKumoUp,
          origin: "auto",
        },
      });
      series.push(createLineSeries("Senkou B", indicators.ichimokuSenkouB, COLORS.ichimokuSenkouB));
    }
    if (indicators.ichimokuChikou) {
      series.push(
        createLineSeries("Chikou", indicators.ichimokuChikou, COLORS.ichimokuChikou, "dashed"),
      );
    }
  }

  // Supertrend
  if (
    enabledIndicators.includes("supertrend") &&
    indicators.supertrendLine &&
    indicators.supertrendDirection
  ) {
    const supertrendData = indicators.supertrendLine.map((val, i) => {
      const dir = indicators.supertrendDirection?.[i];
      return {
        value: val,
        itemStyle: { color: dir === 1 ? COLORS.supertrendUp : COLORS.supertrendDown },
      };
    });
    series.push({
      name: "Supertrend",
      type: "line",
      data: supertrendData,
      symbol: "none",
      lineStyle: { width: 2 },
    });
  }

  // Parabolic SAR
  if (enabledIndicators.includes("parabolicSar") && indicators.parabolicSar) {
    series.push({
      name: "SAR",
      type: "scatter",
      data: indicators.parabolicSar.map((val, i) => {
        const dir = indicators.parabolicSarDirection?.[i];
        return {
          value: val,
          itemStyle: { color: dir === 1 ? COLORS.supertrendUp : COLORS.supertrendDown },
        };
      }),
      symbolSize: 4,
    });
  }
}
