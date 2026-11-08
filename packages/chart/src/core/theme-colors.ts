/**
 * Theme colour lookup: the built-in line palettes and semantic colours, and
 * the resolution of `"@name"` colour tokens against a theme.
 *
 * A series colour may be a CSS colour or a token such as `"@loss"` or
 * `"@palette.3"`. Tokens stay in the series config and are resolved against
 * the current theme when the chart draws, so switching the theme recolours
 * them. Nothing here is imported by the headless entry point.
 */

import { parseColor, relativeLuminance } from "./color-utils";
import type { SeriesConfig } from "./types/series";
import type { SemanticColors, ThemeColors } from "./types/theme";

/**
 * Built-in line palettes, one per mode. Every colour has at least 3:1
 * contrast with the built-in theme's background and stays clear of its
 * candle, crosshair and text colours. The first five stay apart under
 * protanopia and deuteranopia as well. Both have the same length, so
 * switching between dark and light never renumbers a series.
 */
export const BUILTIN_PALETTES: Readonly<Record<"dark" | "light", readonly string[]>> = {
  dark: [
    "#a1bcff",
    "#cb8913",
    "#b073fd",
    "#9ee083",
    "#c77ea1",
    "#72dee7",
    "#ceb66a",
    "#8c91d5",
    "#6cbc54",
    "#e098ee",
    "#fb998c",
    "#21b3ed",
  ],
  light: [
    "#507afd",
    "#874d1d",
    "#7a36a9",
    "#839007",
    "#b6679c",
    "#027495",
    "#7b701e",
    "#4845ca",
    "#0c7202",
    "#824570",
    "#ba2f0c",
    "#138fd2",
  ],
};

/**
 * Built-in semantic colours, one set per mode. Profit and loss lines differ
 * from the candle colours, so a stop or target never reads as a candle; the
 * soft shade of each is a second line of the same meaning.
 */
export const BUILTIN_SEMANTIC: Readonly<Record<"dark" | "light", SemanticColors>> = {
  dark: {
    profit: "#a5d86a",
    profitSoft: "#5f9a2e",
    loss: "#ff6e9c",
    lossSoft: "#b8406a",
    neutral: "#e0a030",
  },
  light: {
    profit: "#3d6608",
    profitSoft: "#6b9a2a",
    loss: "#8e0d42",
    lossSoft: "#c4497a",
    neutral: "#8a6d00",
  },
};

const SEMANTIC_NAMES: ReadonlySet<string> = new Set([
  "profit",
  "profitSoft",
  "loss",
  "lossSoft",
  "neutral",
]);

const PALETTE_PREFIX = "@palette.";

/** Whether `color` is a theme colour token (starts with `@`). */
export function isThemeColorToken(color: string | undefined): color is string {
  return typeof color === "string" && color.charCodeAt(0) === 64; // "@"
}

/** The slot of a `"@palette.N"` token, or `undefined` for anything else. */
export function paletteSlot(color: string | undefined): number | undefined {
  if (!color?.startsWith(PALETTE_PREFIX)) return undefined;
  const n = Number(color.slice(PALETTE_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** The `"@palette.N"` token for slot `n`. */
export function paletteToken(n: number): string {
  return `${PALETTE_PREFIX}${n}`;
}

/** Whether `color` is a token this chart knows. */
export function isKnownThemeColorToken(color: string): boolean {
  const name = color.slice(1);
  return (
    name === "up" || name === "down" || SEMANTIC_NAMES.has(name) || paletteSlot(color) !== undefined
  );
}

/**
 * The mode a theme's built-in palette and semantic colours come from: its
 * `mode`, or else the luminance of its background. `undefined` when the
 * background cannot be read as an opaque colour (`transparent`, an alpha
 * below 1, a CSS variable); callers then use dark, the default theme.
 */
export function readThemeMode(theme: ThemeColors): "dark" | "light" | undefined {
  if (theme.mode) return theme.mode;
  const bg = theme.background.trim().toLowerCase();
  if (bg === "transparent" || !isOpaque(bg)) return undefined;
  const rgb = parseColor(bg);
  if (!rgb) return undefined;
  return relativeLuminance(rgb) > 0.18 ? "light" : "dark";
}

function isOpaque(color: string): boolean {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 4) return hex[3] === "f";
    if (hex.length === 8) return hex.slice(6) === "ff";
    return true;
  }
  const m = color.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (!m) return true;
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 4) return true;
  const a = parts[3].endsWith("%")
    ? Number.parseFloat(parts[3]) / 100
    : Number.parseFloat(parts[3]);
  return a >= 1;
}

/** The line palette of a theme: its own, or the built-in one for its mode. */
export function themePalette(theme: ThemeColors): readonly string[] {
  const own = theme.palette;
  if (own && own.length > 0) return own;
  return BUILTIN_PALETTES[readThemeMode(theme) ?? "dark"];
}

/**
 * The colour `color` stands for under `theme`. A CSS colour comes back as
 * it is. A token is looked up in the theme:
 *
 * - `"@up"` / `"@down"`: the candle colours (`upColor`, `downColor`)
 * - `"@profit"`, `"@profitSoft"`, `"@loss"`, `"@lossSoft"`, `"@neutral"`:
 *   the theme's `semantic` colours, or the built-in ones for its mode
 * - `"@palette.N"`: entry `N` of the theme's `palette` (or the built-in
 *   one), wrapping at its length
 *
 * An unknown token resolves to the theme's text colour.
 *
 * @example
 * ```ts
 * import { DARK_THEME, resolveThemeColor } from "@trendcraft/chart";
 * resolveThemeColor("@loss", DARK_THEME); // "#ff6e9c"
 * resolveThemeColor("#2196F3", DARK_THEME); // "#2196F3"
 * ```
 */
export function resolveThemeColor(color: string, theme: ThemeColors): string {
  if (!isThemeColorToken(color)) return color;
  const name = color.slice(1);
  if (name === "up") return theme.upColor;
  if (name === "down") return theme.downColor;
  if (SEMANTIC_NAMES.has(name)) {
    const key = name as keyof SemanticColors;
    return theme.semantic?.[key] ?? BUILTIN_SEMANTIC[readThemeMode(theme) ?? "dark"][key];
  }
  const slot = paletteSlot(color);
  if (slot !== undefined) {
    const palette = themePalette(theme);
    return palette[slot % palette.length];
  }
  return theme.text;
}

type ColorFields = Pick<SeriesConfig, "color" | "channelColors" | "markers">;

/**
 * `config` with every colour token resolved against `theme`. A config with
 * no token comes back as the same object.
 *
 * A channel that resolves to the first channel's colour, when it was not
 * given that colour itself, takes the first palette colour no other channel
 * has: a series' own colour can land on another of its lines only after a
 * theme switch, so this check is made here, at draw time, and not when the
 * series is added.
 */
export function resolveSeriesColors<T extends ColorFields>(config: T, theme: ThemeColors): T {
  const markers = config.markers;
  const markerColor = typeof markers === "object" && markers ? markers.color : undefined;
  const cc = config.channelColors;
  let hasToken = isThemeColorToken(config.color) || isThemeColorToken(markerColor);
  if (!hasToken && cc) {
    for (const k in cc) {
      if (isThemeColorToken(cc[k])) {
        hasToken = true;
        break;
      }
    }
  }
  if (!hasToken) return config;

  // Reuse the last result while the theme and the colour fields are the
  // same objects, so a frame does not rebuild every series' config.
  const cached = resolvedCache.get(config);
  if (
    cached &&
    cached.generation === cacheGeneration &&
    cached.theme === theme &&
    cached.color === config.color &&
    cached.channelColors === cc &&
    cached.markers === markers
  ) {
    return cached.out as T;
  }

  const out: T = { ...config };
  if (config.color) out.color = resolveThemeColor(config.color, theme);
  if (markerColor && typeof markers === "object") {
    out.markers = { ...markers, color: resolveThemeColor(markerColor, theme) };
  }
  if (cc) {
    const keys = Object.keys(cc);
    const resolved: Record<string, string> = {};
    for (const k of keys) resolved[k] = resolveThemeColor(cc[k], theme);
    const first = keys[0];
    if (first !== undefined) {
      const firstColor = resolved[first].toLowerCase();
      const taken = new Set(keys.map((k) => resolved[k].toLowerCase()));
      for (const k of keys.slice(1)) {
        if (resolved[k].toLowerCase() !== firstColor || cc[k] === cc[first]) continue;
        const spare = themePalette(theme).find((c) => !taken.has(c.toLowerCase()));
        if (spare) {
          resolved[k] = spare;
          taken.add(spare.toLowerCase());
        }
      }
    }
    out.channelColors = resolved;
  }
  resolvedCache.set(config, {
    generation: cacheGeneration,
    theme,
    color: config.color,
    channelColors: cc,
    markers,
    out,
  });
  return out;
}

/**
 * Drop every cached resolution. `setTheme()` calls it, so a theme object
 * edited in place and set again is read afresh.
 */
export function invalidateResolvedColors(): void {
  cacheGeneration++;
}

let cacheGeneration = 0;

const resolvedCache = new WeakMap<
  object,
  {
    generation: number;
    theme: ThemeColors;
    color: string | undefined;
    channelColors: Record<string, string> | undefined;
    markers: SeriesConfig["markers"];
    out: object;
  }
>();

/** Current theme of each live chart, for code that holds only the chart. */
const chartThemes = new WeakMap<object, () => ThemeColors>();

/** Register `chart` so {@link chartTheme} can read its current theme. */
export function registerChartTheme(chart: object, current: () => ThemeColors): void {
  chartThemes.set(chart, current);
}

/** The current theme of `chart`, or `undefined` for a chart not registered. */
export function chartTheme(chart: object): ThemeColors | undefined {
  return chartThemes.get(chart)?.();
}
