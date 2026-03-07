/**
 * Trade Signal Converters
 *
 * Converts various TrendCraft signal types into the unified TradeSignal format.
 */

import type { PipelineResult } from "../../streaming/types";
import type { ScoreBreakdown } from "../../types/scoring";
import type { PriceLevels, TradeSignal } from "../../types/trade-signal";
import type { SqueezeSignal } from "../bollinger-squeeze";
import type { CrossSignalQuality } from "../cross";
import type { DivergenceSignal } from "../divergence";
import type { PatternSignal } from "../patterns/types";

/**
 * Convert a CrossSignalQuality to a TradeSignal
 *
 * @param signal - Cross signal quality result
 * @param entryPrice - Current price at signal time
 * @returns Unified trade signal
 *
 * @example
 * ```ts
 * const signals = validateCrossSignals(candles);
 * const tradeSignals = signals.map(s => fromCrossSignal(s, candles[i].close));
 * ```
 */
export function fromCrossSignal(signal: CrossSignalQuality, entryPrice?: number): TradeSignal {
  const isGolden = signal.type === "golden";
  return {
    id: `cross-${signal.type}-${signal.time}`,
    time: signal.time,
    action: isGolden ? "BUY" : "SELL",
    direction: isGolden ? "LONG" : "SHORT",
    confidence: signal.score,
    prices: entryPrice ? { entry: entryPrice } : undefined,
    reasons: [
      {
        source: "cross",
        name: signal.type === "golden" ? "goldenCross" : "deadCross",
        detail: signal.isFake ? "potential fake signal" : undefined,
      },
    ],
    metadata: {
      isFake: signal.isFake,
      volumeConfirmed: signal.details.volumeConfirmed,
      trendConfirmed: signal.details.trendConfirmed,
      holdingConfirmed: signal.details.holdingConfirmed,
    },
  };
}

/**
 * Convert a DivergenceSignal to a TradeSignal
 *
 * @param signal - Divergence detection result
 * @param entryPrice - Current price at signal time
 * @returns Unified trade signal
 *
 * @example
 * ```ts
 * const divSignals = rsiDivergence(candles);
 * const tradeSignals = divSignals.map(s => fromDivergenceSignal(s, candles[s.secondIdx].close));
 * ```
 */
export function fromDivergenceSignal(signal: DivergenceSignal, entryPrice?: number): TradeSignal {
  const isBullish = signal.type === "bullish";
  return {
    id: `divergence-${signal.type}-${signal.time}`,
    time: signal.time,
    action: isBullish ? "BUY" : "SELL",
    direction: isBullish ? "LONG" : "SHORT",
    confidence: 60,
    prices: entryPrice ? { entry: entryPrice } : undefined,
    reasons: [
      {
        source: "divergence",
        name: signal.type,
        detail: `price ${signal.price.first.toFixed(2)}->${signal.price.second.toFixed(2)}, indicator ${signal.indicator.first.toFixed(2)}->${signal.indicator.second.toFixed(2)}`,
      },
    ],
    metadata: {
      firstIdx: signal.firstIdx,
      secondIdx: signal.secondIdx,
    },
  };
}

/**
 * Convert a SqueezeSignal to a TradeSignal
 *
 * Squeeze signals indicate potential breakout but not direction.
 * Uses BUY/LONG as default; the consumer should combine with
 * other signals to determine actual direction.
 *
 * @param signal - Bollinger squeeze signal
 * @param direction - Expected breakout direction (default: "LONG")
 * @param entryPrice - Current price at signal time
 * @returns Unified trade signal
 *
 * @example
 * ```ts
 * const squeezes = bollingerSqueeze(candles);
 * const tradeSignals = squeezes.map(s => fromSqueezeSignal(s));
 * ```
 */
export function fromSqueezeSignal(
  signal: SqueezeSignal,
  direction: "LONG" | "SHORT" = "LONG",
  entryPrice?: number,
): TradeSignal {
  return {
    id: `squeeze-${signal.time}`,
    time: signal.time,
    action: direction === "LONG" ? "BUY" : "SELL",
    direction,
    confidence: Math.max(10, 100 - signal.percentile),
    prices: entryPrice ? { entry: entryPrice } : undefined,
    reasons: [
      {
        source: "squeeze",
        name: "bollingerSqueeze",
        detail: `bandwidth=${signal.bandwidth.toFixed(4)}, percentile=${signal.percentile.toFixed(1)}`,
      },
    ],
    metadata: {
      bandwidth: signal.bandwidth,
      percentile: signal.percentile,
    },
  };
}

/**
 * Convert a PatternSignal to a TradeSignal
 *
 * Maps pattern target and stopLoss to TradeSignal price levels.
 *
 * @param signal - Pattern recognition signal
 * @param entryPrice - Current price at signal time
 * @returns Unified trade signal
 *
 * @example
 * ```ts
 * const patterns = doubleBottom(candles);
 * const tradeSignals = patterns.map(p => fromPatternSignal(p));
 * ```
 */
export function fromPatternSignal(signal: PatternSignal, entryPrice?: number): TradeSignal {
  const bullishPatterns = ["double_bottom", "inverse_head_shoulders", "cup_handle"];
  const isBullish = bullishPatterns.includes(signal.type);

  let prices: PriceLevels | undefined;
  if (entryPrice) {
    prices = { entry: entryPrice };
    if (signal.pattern.target !== undefined) {
      prices.takeProfit = signal.pattern.target;
    }
    if (signal.pattern.stopLoss !== undefined) {
      prices.stopLoss = signal.pattern.stopLoss;
    }
  }

  return {
    id: `pattern-${signal.type}-${signal.time}`,
    time: signal.time,
    action: isBullish ? "BUY" : "SELL",
    direction: isBullish ? "LONG" : "SHORT",
    confidence: signal.confidence,
    prices,
    reasons: [
      {
        source: "pattern",
        name: signal.type,
        detail: signal.confirmed ? "confirmed" : "unconfirmed",
      },
    ],
    metadata: {
      confirmed: signal.confirmed,
      height: signal.pattern.height,
    },
  };
}

/**
 * Convert a ScoreBreakdown to a TradeSignal
 *
 * Uses the scoring system's normalized score as confidence.
 * Only generates a signal if score meets minimum threshold.
 *
 * @param score - Score breakdown from the scoring system
 * @param time - Signal timestamp
 * @param options - Conversion options
 * @returns Unified trade signal or null if below threshold
 *
 * @example
 * ```ts
 * const breakdown = calculateScoreBreakdown(candles, signals, i);
 * const signal = fromScoreResult(breakdown, candle.time, { minScore: 50 });
 * ```
 */
export function fromScoreResult(
  score: ScoreBreakdown,
  time: number,
  options?: {
    minScore?: number;
    direction?: "LONG" | "SHORT";
    entryPrice?: number;
  },
): TradeSignal | null {
  const minScore = options?.minScore ?? 0;
  if (score.normalizedScore < minScore) return null;

  const direction = options?.direction ?? "LONG";

  return {
    id: `score-${time}`,
    time,
    action: direction === "LONG" ? "BUY" : "SELL",
    direction,
    confidence: score.normalizedScore,
    prices: options?.entryPrice ? { entry: options.entryPrice } : undefined,
    reasons: score.contributions
      .filter((c) => c.isActive)
      .map((c) => ({
        source: "scoring",
        name: c.name,
        detail: `weight=${c.weight}, score=${c.score.toFixed(2)}`,
      })),
    metadata: {
      rawScore: score.rawScore,
      strength: score.strength,
      activeSignals: score.contributions.filter((c) => c.isActive).length,
    },
  };
}

/**
 * Convert a PipelineResult to a TradeSignal
 *
 * Only generates a signal if the pipeline detected an entry or exit signal.
 *
 * @param result - Streaming pipeline evaluation result
 * @param time - Signal timestamp
 * @param entryPrice - Current price
 * @returns Unified trade signal or null if no signal detected
 *
 * @example
 * ```ts
 * const result = pipeline.next(candle);
 * const signal = fromPipelineResult(result, candle.time, candle.close);
 * ```
 */
export function fromPipelineResult(
  result: PipelineResult,
  time: number,
  entryPrice?: number,
): TradeSignal | null {
  if (!result.entrySignal && !result.exitSignal && result.signals.length === 0) {
    return null;
  }

  const isEntry = result.entrySignal;
  const action = isEntry ? "BUY" : result.exitSignal ? "CLOSE" : "BUY";
  const direction: "LONG" | "SHORT" = "LONG";

  const reasons = [];
  if (result.entrySignal) {
    reasons.push({ source: "pipeline", name: "entry" });
  }
  if (result.exitSignal) {
    reasons.push({ source: "pipeline", name: "exit" });
  }
  for (const name of result.signals) {
    reasons.push({ source: "pipeline", name });
  }

  return {
    id: `pipeline-${action}-${time}`,
    time,
    action,
    direction,
    confidence: 50,
    prices: entryPrice ? { entry: entryPrice } : undefined,
    reasons,
    metadata: {
      snapshot: result.snapshot,
    },
  };
}
