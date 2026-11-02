import type { SeriesConfig } from "../core/types";

/**
 * The colour that stands for a series in its legend swatch and labels.
 *
 * A multi-line series (bands, MACD, Ichimoku, …) is drawn with
 * `channelColors` and usually has no `color`, so the first channel colour
 * represents it; falling back to the theme text would show a white or black
 * swatch that matches none of its lines.
 */
export function seriesColor(
  config: Pick<SeriesConfig, "color" | "channelColors">,
  fallback: string,
): string {
  if (config.color) return config.color;
  const channels = config.channelColors;
  if (channels) {
    for (const key of Object.keys(channels)) {
      const c = channels[key];
      if (c) return c;
    }
  }
  return fallback;
}
