/**
 * Series Introspector — Resolves Series<T> to rendering configuration.
 * Uses the SeriesRegistry for type detection and applies indicator presets.
 */

import { type IntrospectionRule, defaultRegistry } from "../core/series-registry";
import type { DataPoint, SeriesConfig, SeriesType } from "../core/types";
import { INDICATOR_PRESETS, type IndicatorPreset } from "./indicator-presets";

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
};

/**
 * Introspect a Series<T> and resolve its rendering configuration.
 *
 * Priority:
 * 1. User-provided config values (explicit overrides)
 * 2. Indicator preset defaults (known indicators)
 * 3. Introspection rule defaults (shape-based detection)
 * 4. Fallback: 'line' on 'new' pane
 */
export function introspect<T>(
  data: DataPoint<T>[],
  userConfig?: SeriesConfig,
): IntrospectionResult {
  const rule = defaultRegistry.detect(data);

  // Try to match a preset by rule name
  const preset = rule ? (INDICATOR_PRESETS.get(rule.name) ?? null) : null;

  // Resolve series type
  const seriesType: SeriesType =
    userConfig?.type ?? preset?.seriesType ?? rule?.seriesType ?? "line";

  // Resolve pane
  const pane: string = userConfig?.pane ?? preset?.pane ?? rule?.defaultPane ?? "new";

  // Merge config
  const config: SeriesConfig = {
    pane,
    type: seriesType,
    color: userConfig?.color ?? preset?.color,
    lineWidth: userConfig?.lineWidth ?? preset?.lineWidth,
    label: userConfig?.label ?? preset?.label ?? rule?.name ?? "Series",
    visible: userConfig?.visible,
  };

  return { seriesType, rule, preset, pane, config };
}
