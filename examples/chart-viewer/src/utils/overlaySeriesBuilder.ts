/**
 * Overlay series builder for main chart indicators
 *
 * Delegates to specialized sub-modules for different overlay categories.
 */

import type { NormalizedCandle } from "trendcraft";
import type { OverlayType } from "../types";
import type { OverlayData } from "../hooks/useOverlays";
import type { SeriesItem } from "./chartColors";
import { buildMovingAverageSeries } from "./overlay/movingAverages";
import { buildBollingerIchimokuSeries } from "./overlay/bollingerIchimoku";
import { buildTrendOverlaySeries } from "./overlay/trendOverlays";
import { buildPriceOverlaySeries } from "./overlay/priceOverlays";
import { buildSmcOverlaySeries } from "./overlay/smcOverlays";

/**
 * Build overlay indicator series for the main chart
 */
export function buildOverlaySeries(
  candles: NormalizedCandle[],
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
  dates: string[],
): SeriesItem[] {
  return [
    ...buildMovingAverageSeries(overlays, enabledOverlays),
    ...buildBollingerIchimokuSeries(overlays, enabledOverlays),
    ...buildTrendOverlaySeries(overlays, enabledOverlays),
    ...buildPriceOverlaySeries(candles, overlays, enabledOverlays),
    ...buildSmcOverlaySeries(candles, overlays, enabledOverlays, dates),
  ];
}
