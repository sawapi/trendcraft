/**
 * Series Introspector — Resolves Series<T> to rendering configuration.
 * Uses __meta from trendcraft, then SeriesRegistry for type detection,
 * and applies indicator presets as fallback.
 */

import { defaultRegistry, type IntrospectionRule } from "../core/series-registry";
import type { DataPoint, SeriesConfig, SeriesType } from "../core/types";
import { INDICATOR_PRESETS, type IndicatorPreset } from "./indicator-presets";

/** Shape of trendcraft's SeriesMeta (read without importing trendcraft) */
type SeriesMeta = {
  overlay: boolean;
  label: string;
  yRange?: [number, number];
  referenceLines?: number[];
};

export type IntrospectionResult = {
  /** Detected visual series type */
  seriesType: SeriesType;
  /** Matched rule (or null for unknown) */
  rule: IntrospectionRule | null;
  /** Matched indicator preset (or null) */
  preset: IndicatorPreset | null;
  /** Resolved pane placement */
  pane: string;
  /** Resolved config (merged user config + preset defaults) */
  config: SeriesConfig;
  /** Y-axis range hint from __meta (e.g., [0, 100] for RSI) */
  yRange?: [number, number];
  /** Reference lines hint from __meta (e.g., [30, 70] for RSI) */
  referenceLines?: number[];
};

/**
 * Extract __meta from a Series if present (trendcraft TaggedSeries).
 */
function extractMeta(data: unknown): SeriesMeta | undefined {
  if (data && typeof data === "object" && "__meta" in data) {
    return (data as { __meta?: SeriesMeta }).__meta;
  }
  return undefined;
}

/**
 * Introspect a Series<T> and resolve its rendering configuration.
 *
 * Priority:
 * 1. User-provided config values (explicit overrides)
 * 2. __meta from trendcraft TaggedSeries
 * 3. Indicator preset defaults (known indicators)
 * 4. Introspection rule defaults (shape-based detection)
 * 5. Fallback: 'line' on 'sub' pane
 */
export function introspect<T>(
  data: DataPoint<T>[],
  userConfig?: SeriesConfig,
): IntrospectionResult {
  const meta = extractMeta(data);
  // Shape detection is always needed for decompose (channel extraction),
  // but when __meta is present, we prefer __meta for pane/type decisions.
  const rule = defaultRegistry.detect(data);

  // Try to match a preset by rule name
  const preset = rule ? (INDICATOR_PRESETS.get(rule.name) ?? null) : null;

  // Resolve series type:
  // user config > preset > rule > fallback "line"
  const seriesType: SeriesType =
    userConfig?.type ?? preset?.seriesType ?? rule?.seriesType ?? "line";

  // Resolve pane: user config > __meta.overlay > preset > rule > fallback
  // When __meta exists, it takes priority over rule's defaultPane.
  const metaPane = meta ? (meta.overlay ? "main" : "sub") : undefined;
  const pane: string = userConfig?.pane ?? metaPane ?? preset?.pane ?? rule?.defaultPane ?? "sub";

  // Resolve label: user config > __meta > preset > rule name
  const label: string = userConfig?.label ?? meta?.label ?? preset?.label ?? rule?.name ?? "Series";

  // Resolve color. preset.color may be a string (fixed) or an array (palette).
  // A palette array flows through as `colorPalette`; the chart's auto-color
  // rotation in canvas-chart picks the next entry per-palette.
  const presetColor = preset?.color;
  const presetPalette = Array.isArray(presetColor) ? presetColor : undefined;
  const presetColorString = typeof presetColor === "string" ? presetColor : undefined;

  // Start from the user's config so every SeriesConfig field reaches the
  // renderer (a hand-listed whitelist silently dropped `markers`), then set
  // the fields resolved against the preset, rule and metadata above.
  const config: SeriesConfig = {
    ...userConfig,
    pane,
    type: seriesType,
    color: userConfig?.color ?? presetColorString,
    colorPalette: userConfig?.color ? undefined : presetPalette,
    lineWidth: userConfig?.lineWidth ?? preset?.lineWidth,
    histogramColorBy: userConfig?.histogramColorBy ?? preset?.histogramColorBy,
    label,
    channelColors: channelColorsWithOwnColor(
      userConfig?.channelColors,
      userConfig?.color,
      preset?.channelColors,
    ),
  };

  return {
    seriesType,
    rule,
    preset,
    pane,
    config,
    yRange: userConfig?.yRange ?? meta?.yRange ?? preset?.yRange,
    referenceLines: userConfig?.referenceLines ?? meta?.referenceLines ?? preset?.referenceLines,
  };
}

/**
 * The channel colours a series is drawn with. The caller's own
 * `channelColors` win. Otherwise a preset's channel colours apply, except
 * that a `color` the caller gave recolours the first channel, the series' own
 * line (the MACD line, %K, ADX); the other channels keep the preset's colours.
 * A channel whose preset colour is the one the first channel now has takes
 * the first channel's preset colour instead, so the two lines stay apart
 * (Slow Stochastics is orange, the preset %D's colour).
 */
export function channelColorsWithOwnColor(
  own: Record<string, string> | undefined,
  color: string | undefined,
  preset: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (own) return own;
  if (!preset) return undefined;
  if (!color) return preset;
  const [first] = Object.keys(preset);
  if (first === undefined) return preset;
  const displaced = preset[first];
  const out: Record<string, string> = { ...preset, [first]: color };
  for (const name of Object.keys(preset)) {
    if (name !== first && preset[name]?.toLowerCase() === color.toLowerCase() && displaced) {
      out[name] = displaced;
    }
  }
  return out;
}
