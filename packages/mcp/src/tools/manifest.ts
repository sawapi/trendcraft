import {
  type IndicatorCategory,
  type IndicatorManifest,
  type MarketRegime,
  type Timeframe,
  formatManifestMarkdown,
  getManifest,
  listManifests,
  suggestForRegime,
} from "trendcraft/manifest";
import { z } from "zod";
import { supportedKindsSet } from "../dispatcher/safe-map";

const CATEGORY_VALUES = [
  "moving-average",
  "momentum",
  "volatility",
  "trend",
  "volume",
  "price",
  "session",
  "regime",
  "smc",
  "wyckoff",
] as const satisfies readonly IndicatorCategory[];

const REGIME_VALUES = [
  "trending",
  "ranging",
  "volatile",
  "low-volatility",
] as const satisfies readonly MarketRegime[];

const TIMEFRAME_VALUES = ["intraday", "swing", "position"] as const satisfies readonly Timeframe[];

export const listIndicatorsInputShape = {
  category: z.enum(CATEGORY_VALUES).optional(),
  regime: z.enum(REGIME_VALUES).optional(),
  timeframe: z.enum(TIMEFRAME_VALUES).optional(),
  /**
   * When set, restrict results to entries whose calc_indicator wrapper
   * matches this flag — `true` returns only computable kinds, `false`
   * returns only manifest-only kinds. Omit to include everything.
   */
  calcSupported: z.boolean().optional(),
};

export const getManifestInputShape = {
  kind: z.string().min(1),
};

export const suggestForRegimeInputShape = {
  regime: z.enum(REGIME_VALUES),
};

export const formatMarkdownInputShape = {
  kind: z.string().min(1),
};

export interface IndicatorSummary {
  kind: string;
  displayName: string;
  category: IndicatorCategory;
  oneLiner: string;
  /** True iff calc_indicator can compute this kind (a `trendcraft/safe` wrapper exists). */
  calcSupported: boolean;
}

function summarize(m: IndicatorManifest, supported: Set<string>): IndicatorSummary {
  return {
    kind: m.kind,
    displayName: m.displayName,
    category: m.category,
    oneLiner: m.oneLiner,
    calcSupported: supported.has(m.kind),
  };
}

export function listIndicatorsHandler(input: {
  category?: IndicatorCategory;
  regime?: MarketRegime;
  timeframe?: Timeframe;
  calcSupported?: boolean;
}): IndicatorSummary[] {
  const supported = supportedKindsSet();
  const summaries = listManifests({
    category: input.category,
    regime: input.regime,
    timeframe: input.timeframe,
  }).map((m) => summarize(m, supported));

  if (input.calcSupported === undefined) return summaries;
  return summaries.filter((s) => s.calcSupported === input.calcSupported);
}

export function getManifestHandler(input: { kind: string }): IndicatorManifest {
  const m = getManifest(input.kind);
  if (!m) {
    throw new Error(
      `UNKNOWN_KIND: no manifest entry for kind "${input.kind}". (UNKNOWN_KIND = manifest miss; UNSUPPORTED_KIND = manifest exists but no calc wrapper. Use list_indicators to discover valid kinds.)`,
    );
  }
  return m;
}

export function suggestForRegimeHandler(input: { regime: MarketRegime }): IndicatorManifest[] {
  return suggestForRegime(input.regime);
}

export function formatMarkdownHandler(input: { kind: string }): string {
  const m = getManifest(input.kind);
  if (!m) {
    throw new Error(
      `UNKNOWN_KIND: no manifest entry for kind "${input.kind}". Use list_indicators to discover valid kinds.`,
    );
  }
  return formatManifestMarkdown(m);
}
