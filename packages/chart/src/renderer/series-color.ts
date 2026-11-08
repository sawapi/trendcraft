import { resolveSeriesColors, themePalette } from "../core/theme-colors";
import type { SeriesConfig, ThemeColors } from "../core/types";

/**
 * The colour that stands for a series in its legend swatch and labels.
 *
 * A multi-line series (bands, MACD, Ichimoku, …) is drawn with
 * `channelColors` and usually has no `color`, so the first channel colour
 * represents it; falling back to the theme text would show a white or black
 * swatch that matches none of its lines.
 *
 * Colour tokens are resolved against `theme`. A series with no colour at all
 * takes the theme text colour, or, for a `type: "histogram"` series, its
 * up-volume or up-candle colour (see below).
 */
export function seriesColor(
  raw: Pick<SeriesConfig, "color" | "channelColors" | "type" | "histogramColorBy">,
  theme: ThemeColors,
): string {
  const config = resolveSeriesColors(raw, theme);
  if (config.color) return config.color;
  const channels = config.channelColors;
  if (channels) {
    for (const key of Object.keys(channels)) {
      const c = channels[key];
      if (c) return c;
    }
  }
  // A single histogram with no colour of its own is drawn in the theme's
  // up / down volume colours, or its candle colours when coloured by sign
  // or change, so its swatch takes that up colour. A multi-channel series
  // typed "histogram" (MACD) has its channel colours.
  if (config.type === "histogram") {
    const byCandle = (config.histogramColorBy ?? "candle") === "candle";
    return byCandle ? theme.volumeUp : theme.upColor;
  }
  return theme.text;
}

/**
 * The colour of each line of a multi-line series drawn as plain lines (ORB,
 * VWAP bands, EMA Ribbon, …). A channel colour the series was given wins.
 * Otherwise the first line is the series' own line and takes the series
 * colour, and the others take spare colours from the theme palette, skipping
 * any colour another line of the same series already has, so no two lines
 * look alike. Colour tokens are resolved against `theme`.
 */
export function plainChannelColors(
  names: readonly string[],
  raw: Pick<SeriesConfig, "color" | "channelColors">,
  theme: ThemeColors,
): string[] {
  const config = resolveSeriesColors(raw, theme);
  const spares = themePalette(theme);
  const cc = config.channelColors;
  const taken = new Set<string>();
  for (const name of names) {
    const c = cc?.[name];
    if (c) taken.add(c.toLowerCase());
  }
  if (config.color) taken.add(config.color.toLowerCase());
  const n = spares.length;
  return names.map((name, i) => {
    const own = cc?.[name] ?? (i === 0 ? config.color : undefined);
    if (own) return own;
    // Start where the list used to put this line, so lines that never
    // clashed keep their colours.
    for (let k = 0; k < n; k++) {
      const c = spares[(i + k) % n];
      if (!taken.has(c.toLowerCase())) {
        taken.add(c.toLowerCase());
        return c;
      }
    }
    return spares[i % n];
  });
}
