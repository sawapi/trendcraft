/**
 * Indicator Manifest — LLM-facing metadata for indicators.
 *
 * Used by runtime LLM agents (e.g. alpaca-demo strategy generator) and
 * future MCP servers as prompt context. Describes when/why an indicator
 * is useful, common signals, pitfalls, and synergies — judgment context
 * that cannot be derived from function signatures or JSDoc alone.
 *
 * `kind` joins to `SeriesMeta.kind` from indicator-meta.ts (single
 * source of identity). This module ships as a separate entry point
 * (`trendcraft/manifest`) so the main bundle is unaffected.
 */

export type IndicatorCategory =
  | "moving-average"
  | "momentum"
  | "volatility"
  | "trend"
  | "volume"
  | "price"
  | "session"
  | "regime"
  | "smc"
  | "wyckoff";

export type MarketRegime = "trending" | "ranging" | "volatile" | "low-volatility";

export type Timeframe = "intraday" | "swing" | "position";

export interface IndicatorManifest {
  /** Stable identity key — matches indicator-meta.ts SeriesMeta.kind. */
  kind: string;
  /** Human-readable display name. */
  displayName: string;
  category: IndicatorCategory;
  /** Single-sentence summary suitable for compact listings. */
  oneLiner: string;
  /** Bullet points: market conditions where this indicator shines. */
  whenToUse: string[];
  /** Common signal interpretations (e.g. "RSI > 70 = overbought"). */
  signals: string[];
  /** Failure modes the LLM should avoid recommending in. */
  pitfalls: string[];
  /** Optional: indicators that pair well, with reason. */
  synergy?: string[];
  /** Market regimes this indicator is well-suited for. */
  marketRegime: MarketRegime[];
  /** Timeframes this indicator is typically applied to. */
  timeframe: Timeframe[];
  /** Optional per-parameter usage notes. */
  paramHints?: Record<string, string>;
}
