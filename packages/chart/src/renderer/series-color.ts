import type { SeriesConfig } from "../core/types";

/**
 * The colour that stands for a series in its legend swatch and labels.
 *
 * A multi-line series (bands, MACD, Ichimoku, …) is drawn with
 * `channelColors` and usually has no `color`, so the first channel colour
 * represents it; falling back to the theme text would show a white or black
 * swatch that matches none of its lines.
 *
 * `volumeUp` is the theme's up-volume colour, for a `type: "histogram"`
 * series with no `color` (see below).
 */
export function seriesColor(
  config: Pick<SeriesConfig, "color" | "channelColors" | "type">,
  fallback: string,
  volumeUp: string = fallback,
): string {
  if (config.color) return config.color;
  // A histogram with no colour of its own is drawn in the theme's up / down
  // volume colours, so its swatch takes the up colour.
  if (config.type === "histogram") return volumeUp;
  const channels = config.channelColors;
  if (channels) {
    for (const key of Object.keys(channels)) {
      const c = channels[key];
      if (c) return c;
    }
  }
  return fallback;
}
