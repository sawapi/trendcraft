import { COLORS, type SeriesItem, createLineSeries } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build moving average overlay series
 */
export function buildMovingAverageOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // SMA
  if (enabledIndicators.includes("sma5") && indicators.sma5) {
    series.push(createLineSeries("SMA5", indicators.sma5, COLORS.sma5));
  }
  if (enabledIndicators.includes("sma25") && indicators.sma25) {
    series.push(createLineSeries("SMA25", indicators.sma25, COLORS.sma25));
  }
  if (enabledIndicators.includes("sma75") && indicators.sma75) {
    series.push(createLineSeries("SMA75", indicators.sma75, COLORS.sma75));
  }

  // EMA
  if (enabledIndicators.includes("ema12") && indicators.ema12) {
    series.push(createLineSeries("EMA12", indicators.ema12, COLORS.ema12));
  }
  if (enabledIndicators.includes("ema26") && indicators.ema26) {
    series.push(createLineSeries("EMA26", indicators.ema26, COLORS.ema26));
  }

  // WMA
  if (enabledIndicators.includes("wma") && indicators.wma) {
    series.push(createLineSeries("WMA", indicators.wma, COLORS.wma));
  }

  // VWMA
  if (enabledIndicators.includes("vwma") && indicators.vwma) {
    series.push(createLineSeries("VWMA", indicators.vwma, COLORS.vwma));
  }

  // KAMA
  if (enabledIndicators.includes("kama") && indicators.kama) {
    series.push(createLineSeries("KAMA", indicators.kama, COLORS.kama));
  }

  // T3
  if (enabledIndicators.includes("t3") && indicators.t3) {
    series.push(createLineSeries("T3", indicators.t3, COLORS.t3));
  }

  // HMA
  if (enabledIndicators.includes("hma") && indicators.hma) {
    series.push(createLineSeries("HMA", indicators.hma, COLORS.hma));
  }

  // McGinley Dynamic
  if (enabledIndicators.includes("mcginley") && indicators.mcginley) {
    series.push(createLineSeries("McGinley", indicators.mcginley, COLORS.mcginley));
  }

  // EMA Ribbon
  if (enabledIndicators.includes("emaRibbon") && indicators.emaRibbonValues) {
    const ribbonColors = [
      COLORS.emaRibbon1,
      COLORS.emaRibbon2,
      COLORS.emaRibbon3,
      COLORS.emaRibbon4,
      COLORS.emaRibbon5,
      COLORS.emaRibbon6,
    ];
    const ribbonPeriods = indicators.emaRibbonPeriods || [8, 13, 21, 34, 55, 89];

    for (let i = 0; i < indicators.emaRibbonValues.length; i++) {
      const data = indicators.emaRibbonValues[i];
      const color = ribbonColors[i % ribbonColors.length];
      const period = ribbonPeriods[i] || i;
      series.push(createLineSeries(`EMA ${period}`, data, color, "solid", 1));
    }
  }
}
