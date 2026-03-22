import { COLORS, type SeriesItem, createLineSeries } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build band/channel overlay series
 */
export function buildBandOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // Bollinger Bands
  if (enabledIndicators.includes("bb")) {
    if (indicators.bbUpper) {
      series.push(createLineSeries("BB Upper", indicators.bbUpper, COLORS.bbUpper, "dashed"));
    }
    if (indicators.bbMiddle) {
      series.push(createLineSeries("BB Middle", indicators.bbMiddle, COLORS.bbMiddle));
    }
    if (indicators.bbLower) {
      series.push(createLineSeries("BB Lower", indicators.bbLower, COLORS.bbLower, "dashed"));
    }
  }

  // Keltner Channel
  if (enabledIndicators.includes("keltner")) {
    if (indicators.keltnerUpper) {
      series.push(
        createLineSeries("Keltner Upper", indicators.keltnerUpper, COLORS.keltnerUpper, "dashed"),
      );
    }
    if (indicators.keltnerMiddle) {
      series.push(
        createLineSeries("Keltner Middle", indicators.keltnerMiddle, COLORS.keltnerMiddle),
      );
    }
    if (indicators.keltnerLower) {
      series.push(
        createLineSeries("Keltner Lower", indicators.keltnerLower, COLORS.keltnerLower, "dashed"),
      );
    }
  }

  // Donchian Channel
  if (enabledIndicators.includes("donchian")) {
    if (indicators.donchianUpper) {
      series.push(
        createLineSeries(
          "Donchian Upper",
          indicators.donchianUpper,
          COLORS.donchianUpper,
          "dashed",
        ),
      );
    }
    if (indicators.donchianMiddle) {
      series.push(
        createLineSeries("Donchian Middle", indicators.donchianMiddle, COLORS.donchianMiddle),
      );
    }
    if (indicators.donchianLower) {
      series.push(
        createLineSeries(
          "Donchian Lower",
          indicators.donchianLower,
          COLORS.donchianLower,
          "dashed",
        ),
      );
    }
  }

  // Chandelier Exit
  if (enabledIndicators.includes("chandelierExit")) {
    if (indicators.chandelierLongExit) {
      series.push(
        createLineSeries(
          "Chandelier Long",
          indicators.chandelierLongExit,
          COLORS.chandelierLong,
          "dashed",
        ),
      );
    }
    if (indicators.chandelierShortExit) {
      series.push(
        createLineSeries(
          "Chandelier Short",
          indicators.chandelierShortExit,
          COLORS.chandelierShort,
          "dashed",
        ),
      );
    }
  }

  // VWAP
  if (enabledIndicators.includes("vwap")) {
    if (indicators.vwapLine) {
      series.push(createLineSeries("VWAP", indicators.vwapLine, COLORS.vwapLine, "solid", 2));
    }
    if (indicators.vwapUpper) {
      series.push(createLineSeries("VWAP Upper", indicators.vwapUpper, COLORS.vwapUpper, "dashed"));
    }
    if (indicators.vwapLower) {
      series.push(createLineSeries("VWAP Lower", indicators.vwapLower, COLORS.vwapLower, "dashed"));
    }
  }

  // ATR Stops
  if (enabledIndicators.includes("atrStops")) {
    if (indicators.atrStopsLong) {
      series.push(
        createLineSeries("ATR Stop Long", indicators.atrStopsLong, COLORS.atrStopsLong, "dotted"),
      );
    }
    if (indicators.atrStopsShort) {
      series.push(
        createLineSeries(
          "ATR Stop Short",
          indicators.atrStopsShort,
          COLORS.atrStopsShort,
          "dotted",
        ),
      );
    }
  }

  // Super Smoother
  if (enabledIndicators.includes("superSmoother") && indicators.superSmootherLine) {
    series.push(
      createLineSeries(
        "Super Smoother",
        indicators.superSmootherLine,
        COLORS.superSmootherLine,
        "solid",
        2,
      ),
    );
  }
}
