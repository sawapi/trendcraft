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
}

function summarize(m: IndicatorManifest): IndicatorSummary {
  return {
    kind: m.kind,
    displayName: m.displayName,
    category: m.category,
    oneLiner: m.oneLiner,
  };
}

export function listIndicatorsHandler(input: {
  category?: IndicatorCategory;
  regime?: MarketRegime;
  timeframe?: Timeframe;
}): IndicatorSummary[] {
  return listManifests(input).map(summarize);
}

export function getManifestHandler(input: { kind: string }): IndicatorManifest {
  const m = getManifest(input.kind);
  if (!m) {
    throw new Error(`UNKNOWN_KIND: no manifest entry for kind "${input.kind}"`);
  }
  return m;
}

export function suggestForRegimeHandler(input: { regime: MarketRegime }): IndicatorManifest[] {
  return suggestForRegime(input.regime);
}

export function formatMarkdownHandler(input: { kind: string }): string {
  const m = getManifest(input.kind);
  if (!m) {
    throw new Error(`UNKNOWN_KIND: no manifest entry for kind "${input.kind}"`);
  }
  return formatManifestMarkdown(m);
}
