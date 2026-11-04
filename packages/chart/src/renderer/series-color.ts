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
  const channels = config.channelColors;
  if (channels) {
    for (const key of Object.keys(channels)) {
      const c = channels[key];
      if (c) return c;
    }
  }
  // A single histogram with no colour of its own is drawn in the theme's
  // up / down volume colours, so its swatch takes the up colour. A
  // multi-channel series typed "histogram" (MACD) has its channel colours.
  if (config.type === "histogram") return volumeUp;
  return fallback;
}

/** Spare line colours for channels that have none of their own. */
const SPARE_CHANNEL_COLORS = ["#2196F3", "#FF9800", "#26a69a", "#ef5350", "#9c27b0", "#FF5722"];

/**
 * The colour of each line of a multi-line series drawn as plain lines (ORB,
 * VWAP bands, EMA Ribbon, …). A channel colour the series was given wins.
 * Otherwise the first line is the series' own line and takes the series
 * colour, and the others take spare colours, skipping any colour another
 * line of the same series already has, so no two lines look alike.
 */
export function plainChannelColors(
  names: readonly string[],
  config: Pick<SeriesConfig, "color" | "channelColors">,
): string[] {
  const cc = config.channelColors;
  const taken = new Set<string>();
  for (const name of names) {
    const c = cc?.[name];
    if (c) taken.add(c.toLowerCase());
  }
  if (config.color) taken.add(config.color.toLowerCase());
  const n = SPARE_CHANNEL_COLORS.length;
  return names.map((name, i) => {
    const own = cc?.[name] ?? (i === 0 ? config.color : undefined);
    if (own) return own;
    // Start where the list used to put this line, so lines that never
    // clashed keep their colours.
    for (let k = 0; k < n; k++) {
      const c = SPARE_CHANNEL_COLORS[(i + k) % n];
      if (!taken.has(c.toLowerCase())) {
        taken.add(c.toLowerCase());
        return c;
      }
    }
    return SPARE_CHANNEL_COLORS[i % n];
  });
}
