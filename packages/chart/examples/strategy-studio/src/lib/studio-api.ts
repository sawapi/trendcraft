import {
  type BacktestResult,
  type Condition,
  type ConditionCategory,
  type ConditionRegistryEntry,
  type IndicatorPreset,
  type MarketRegimeResult,
  type StrategyJSON,
  backtestRegistry,
  detectMarketRegime,
  getIndicatorPreset,
  indicatorPresets,
  loadStrategy,
  normalizeCandles,
  runBacktest,
} from "trendcraft";
import {
  type IndicatorCategory,
  type IndicatorManifest,
  type MarketRegime,
  listManifests,
  suggestForRegime,
} from "trendcraft/manifest";
import type { StudioCandle } from "./sample-data";

export type RegimeSummary = {
  /** Detected by detectMarketRegime — granular volatility + trend snapshot. */
  raw: MarketRegimeResult;
  /** Mapped to manifest's MarketRegime taxonomy for suggestForRegime(). */
  manifestRegime: MarketRegime;
  /** Human-readable bullets describing how the regime was inferred. */
  reasons: string[];
};

/**
 * Bridge from the granular `detectMarketRegime` result to the four-bucket
 * `MarketRegime` taxonomy used by the manifest. Volatility extremes win over
 * trend classification because they change which playbook applies first
 * (widen stops / reduce size before picking a direction).
 */
function toManifestRegime(raw: MarketRegimeResult): {
  regime: MarketRegime;
  reasons: string[];
} {
  const reasons: string[] = [];
  reasons.push(
    `Volatility: ${raw.volatility} · Trend: ${raw.trend} · ADX ${raw.trendStrength.toFixed(0)}`,
  );

  if (raw.volatility === "high") {
    reasons.push("High ATR percentile → favor volatility-aware playbook");
    return { regime: "volatile", reasons };
  }
  if (raw.volatility === "low" && raw.trend === "sideways") {
    reasons.push("Low ATR + sideways → mean-reversion / range tools shine");
    return { regime: "low-volatility", reasons };
  }
  if (raw.trend !== "sideways" && raw.trendStrength >= 25) {
    reasons.push("ADX ≥ 25 with directional bias → trending-friendly setups");
    return { regime: "trending", reasons };
  }
  reasons.push("ADX < 25 / sideways → range-bound until breakout confirms");
  return { regime: "ranging", reasons };
}

export type StrategyRunResult = {
  /** The JSON that was actually executed. Single source of truth for any
   * downstream panel that needs to rerun the same strategy (PortfolioPanel,
   * future PR12 OptimizationPanel) — keeps result + json bundled so the host
   * can't accidentally show metrics for one strategy alongside settings from
   * another. */
  json: StrategyJSON;
  result: BacktestResult;
  trades: BacktestResult["trades"];
};

/**
 * Domain operations Strategy Studio panels rely on. PR2 provides a `local`
 * implementation that calls trendcraft directly (no LLM, no network). PR (Phase 2)
 * will add an MCP-backed implementation behind the same interface so the UI
 * stays unchanged.
 */
export interface StudioAPI {
  detectRegime(candles: StudioCandle[]): RegimeSummary;
  suggestPresets(regime: MarketRegime): IndicatorManifest[];
  listIndicators(filter?: { category?: IndicatorCategory }): IndicatorManifest[];
  /**
   * Resolve a manifest `kind` to its `indicatorPresets` entry. Returns
   * `undefined` for kinds that intentionally have no series preset (regime
   * classifiers, smc events, etc.). Manifest long-name ↔ short-key drift is
   * handled by core's `getIndicatorPreset`.
   */
  getIndicatorPreset(kind: string): IndicatorPreset | undefined;
  /**
   * Reverse-lookup: manifest `kind` → the canonical `indicatorPresets`
   * registry key the chart's `connectIndicators({ presets }).add(key, ...)`
   * expects. Needed because the chart's bracket lookup wants the short key
   * (`bb`) while the host typically carries the manifest's long name
   * (`bollingerBands`). Returns `undefined` for unresolved kinds.
   */
  resolvePresetKey(kind: string): string | undefined;
  /** All registered backtest conditions, optionally filtered by category. */
  listConditions(category?: ConditionCategory): ConditionRegistryEntry<Condition>[];
  runStrategy(json: StrategyJSON, candles: StudioCandle[]): StrategyRunResult;
}

export const localStudioAPI: StudioAPI = {
  detectRegime(candles) {
    const raw = detectMarketRegime(candles);
    const { regime, reasons } = toManifestRegime(raw);
    return { raw, manifestRegime: regime, reasons };
  },

  suggestPresets(regime) {
    return suggestForRegime(regime);
  },

  listIndicators(filter) {
    return listManifests(filter);
  },

  getIndicatorPreset(kind) {
    return getIndicatorPreset(kind);
  },

  resolvePresetKey(kind) {
    const preset = getIndicatorPreset(kind);
    if (!preset) return undefined;
    if (indicatorPresets[kind] === preset) return kind;
    for (const [key, p] of Object.entries(indicatorPresets)) {
      if (p === preset) return key;
    }
    return undefined;
  },

  listConditions(category) {
    return backtestRegistry.list(category);
  },

  runStrategy(json, candles) {
    const { entry, exit, backtestOptions } = loadStrategy(json, backtestRegistry);
    const normalized = normalizeCandles(candles);
    const result = runBacktest(normalized, entry, exit, {
      capital: 100_000,
      ...backtestOptions,
    });
    return { json, result, trades: result.trades };
  },
};
