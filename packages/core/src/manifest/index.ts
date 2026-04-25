/**
 * Indicator Manifest entry point — `trendcraft/manifest`.
 *
 * Opt-in module providing LLM-facing metadata for indicators. Not loaded
 * by the main `trendcraft` bundle. Intended for runtime LLM agents and
 * MCP servers that embed indicator descriptions in prompts.
 *
 * @example
 * ```ts
 * import { getManifest, listManifests } from "trendcraft/manifest";
 *
 * const rsi = getManifest("rsi");
 * console.log(rsi?.whenToUse);
 *
 * const trendIndicators = listManifests({ category: "trend" });
 * ```
 */

import { MOMENTUM_MANIFESTS } from "./entries/momentum";
import { MOVING_AVERAGE_MANIFESTS } from "./entries/moving-average";
import { PRICE_MANIFESTS } from "./entries/price";
import { SPECIALIZED_MANIFESTS } from "./entries/specialized";
import { TREND_MANIFESTS } from "./entries/trend";
import { VOLATILITY_MANIFESTS } from "./entries/volatility";
import { VOLUME_MANIFESTS } from "./entries/volume";
import type { IndicatorCategory, IndicatorManifest, MarketRegime, Timeframe } from "./types";

export type { IndicatorCategory, IndicatorManifest, MarketRegime, Timeframe } from "./types";

const ALL_MANIFESTS: readonly IndicatorManifest[] = [
  ...MOVING_AVERAGE_MANIFESTS,
  ...MOMENTUM_MANIFESTS,
  ...VOLATILITY_MANIFESTS,
  ...TREND_MANIFESTS,
  ...VOLUME_MANIFESTS,
  ...PRICE_MANIFESTS,
  ...SPECIALIZED_MANIFESTS,
];

const MANIFEST_BY_KIND: ReadonlyMap<string, IndicatorManifest> = new Map(
  ALL_MANIFESTS.map((m) => [m.kind, m]),
);

/**
 * Look up the manifest for an indicator by its `kind` (matches
 * `SeriesMeta.kind` from indicator-meta.ts). Returns `undefined` if no
 * manifest entry exists for that kind yet.
 */
export function getManifest(kind: string): IndicatorManifest | undefined {
  return MANIFEST_BY_KIND.get(kind);
}

/**
 * List all manifest entries, optionally filtered by category, regime, or timeframe.
 */
export function listManifests(filter?: {
  category?: IndicatorCategory;
  regime?: MarketRegime;
  timeframe?: Timeframe;
}): IndicatorManifest[] {
  if (!filter) return [...ALL_MANIFESTS];
  return ALL_MANIFESTS.filter((m) => {
    if (filter.category && m.category !== filter.category) return false;
    if (filter.regime && !m.marketRegime.includes(filter.regime)) return false;
    if (filter.timeframe && !m.timeframe.includes(filter.timeframe)) return false;
    return true;
  });
}

/**
 * Suggest indicators well-suited for a given market regime, ordered as
 * declared in the manifest list. A convenience for LLM prompts.
 */
export function suggestForRegime(regime: MarketRegime): IndicatorManifest[] {
  return listManifests({ regime });
}

/**
 * Render a manifest entry as a compact markdown block — useful for
 * embedding directly in LLM prompts without custom formatting.
 */
export function formatManifestMarkdown(m: IndicatorManifest): string {
  const lines: string[] = [];
  lines.push(`### ${m.displayName} (\`${m.kind}\`)`);
  lines.push(m.oneLiner);
  lines.push("");
  lines.push(`- Category: ${m.category}`);
  lines.push(`- Regimes: ${m.marketRegime.join(", ")}`);
  lines.push(`- Timeframes: ${m.timeframe.join(", ")}`);
  if (m.whenToUse.length) {
    lines.push("- When to use:");
    for (const w of m.whenToUse) lines.push(`  - ${w}`);
  }
  if (m.signals.length) {
    lines.push("- Signals:");
    for (const s of m.signals) lines.push(`  - ${s}`);
  }
  if (m.pitfalls.length) {
    lines.push("- Pitfalls:");
    for (const p of m.pitfalls) lines.push(`  - ${p}`);
  }
  if (m.synergy?.length) {
    lines.push("- Synergy:");
    for (const s of m.synergy) lines.push(`  - ${s}`);
  }
  return lines.join("\n");
}

/** All manifest entries as a frozen array (read-only). */
export const indicatorManifests: readonly IndicatorManifest[] = ALL_MANIFESTS;
