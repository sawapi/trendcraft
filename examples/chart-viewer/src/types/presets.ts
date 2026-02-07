import type { OverlayType, SubChartType } from "./chart";
import type { IndicatorParams } from "./indicators";

/**
 * Indicator preset (saved configuration)
 */
export interface IndicatorPreset {
  name: string;
  params: IndicatorParams;
  overlays: OverlayType[];
  indicators: SubChartType[];
}
