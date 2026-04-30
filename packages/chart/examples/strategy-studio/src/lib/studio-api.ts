import {
  type BacktestResult,
  type IndicatorPreset,
  type MarketRegimeResult,
  backtestRegistry,
  detectMarketRegime,
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
   * Resolve a manifest `kind` to its `indicatorPresets` entry. Some manifest
   * kinds use a different short key in the preset registry (`bollingerBands`
   * vs `bb`, etc.) — see `KIND_TO_PRESET_KEY`. Returns `undefined` for kinds
   * that intentionally have no series preset (e.g. `hmmRegimes`, `liquiditySweep`).
   */
  getIndicatorPreset(kind: string): IndicatorPreset | undefined;
  runStrategy(json: unknown, candles: StudioCandle[]): StrategyRunResult;
}

/**
 * Manifest `kind` → `indicatorPresets` key for entries where the two registries
 * use different identifiers. Manifest kinds use the function name (e.g.
 * `bollingerBands`); the preset registry uses a shorter key (`bb`).
 *
 * Kinds not listed here use their manifest kind as the preset key directly.
 * Kinds with no preset entry at all (regime classifiers, smc events) resolve
 * to `undefined` from `getIndicatorPreset`.
 */
export const KIND_TO_PRESET_KEY: Record<string, string> = {
  awesomeOscillator: "ao",
  balanceOfPower: "bop",
  bollingerBands: "bb",
  choppinessIndex: "choppiness",
  coppockCurve: "coppock",
  donchianChannel: "donchian",
  easeOfMovement: "emv",
  ewmaVolatility: "ewmaVol",
  fairValueGap: "fvg",
  historicalVolatility: "hv",
  keltnerChannel: "keltner",
  openingRange: "orb",
  ulcerIndex: "ulcer",
};

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
    return indicatorPresets[KIND_TO_PRESET_KEY[kind] ?? kind];
  },

  runStrategy(json, candles) {
    // biome-ignore lint/suspicious/noExplicitAny: StrategyJSON typing belongs to PR3
    const { entry, exit, backtestOptions } = loadStrategy(json as any, backtestRegistry);
    const normalized = normalizeCandles(candles);
    const result = runBacktest(normalized, entry, exit, {
      capital: 100_000,
      ...backtestOptions,
    });
    return { result, trades: result.trades };
  },
};
