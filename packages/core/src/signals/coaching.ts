/**
 * Signal Coaching Layer
 *
 * Detects coaching signals from candle data at a given index and returns
 * human-readable coaching messages for traders. Computes all indicators
 * internally — no pre-computed indicator data required.
 *
 * @example
 * ```ts
 * import { detectCoachingSignals } from "trendcraft";
 *
 * const signals = detectCoachingSignals(candles, candles.length - 1);
 * for (const s of signals) {
 *   console.log(`[${s.severity}] ${s.message}: ${s.detail}`);
 * }
 * ```
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { dmi } from "../indicators/momentum/dmi";
import { macd } from "../indicators/momentum/macd";
import { rsi } from "../indicators/momentum/rsi";
import { stochastics } from "../indicators/momentum/stochastics";
import { sma } from "../indicators/moving-average/sma";
import { supertrend } from "../indicators/trend/supertrend";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import type { Candle, NormalizedCandle } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of the coaching signal. */
export type CoachingDirection = "bullish" | "bearish" | "info";

/** Urgency level of the coaching signal. */
export type CoachingSeverity = "high" | "medium" | "low";

/**
 * A coaching signal with human-readable explanation.
 */
export type CoachingSignal = {
  /** Signal identifier (e.g., "RSI_OVERSOLD", "MACD_BULLISH_CROSS") */
  type: string;
  /** Directional bias */
  direction: CoachingDirection;
  /** Urgency / importance */
  severity: CoachingSeverity;
  /** Short message */
  message: string;
  /** Detailed coaching text */
  detail: string;
  /** Source indicator name */
  indicator: string;
};

/**
 * Options for coaching signal detection.
 */
export type CoachingOptions = {
  /** Filter to specific signal types. If omitted, all signals are checked. */
  enabledSignals?: string[];
  /** Short SMA period for cross detection. Default: 25 */
  smaShort?: number;
  /** Long SMA period for cross detection. Default: 75 */
  smaLong?: number;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Detect coaching signals at a given candle index.
 *
 * Computes RSI, MACD, Bollinger Bands, SMA cross, DMI/ADX, Stochastics,
 * Supertrend, volume spike, and basic candlestick patterns. Returns
 * human-readable coaching messages for each detected signal.
 *
 * @param candles - Array of candles
 * @param index - The candle index to analyze (defaults to last candle)
 * @param options - Optional configuration
 * @returns Array of coaching signals detected at the given index
 *
 * @example
 * ```ts
 * const signals = detectCoachingSignals(candles, 100, {
 *   enabledSignals: ["RSI_OVERSOLD", "MACD_BULLISH_CROSS"],
 * });
 * ```
 */
export function detectCoachingSignals(
  candles: Candle[] | NormalizedCandle[],
  index?: number,
  options?: CoachingOptions,
): CoachingSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const idx = index ?? normalized.length - 1;

  if (idx < 2 || normalized.length < 3) return [];

  const slice = normalized.slice(0, idx + 1);
  const curr = slice.length - 1;
  const prev = curr - 1;

  const opts = {
    smaShort: options?.smaShort ?? 25,
    smaLong: options?.smaLong ?? 75,
  };

  const signals: CoachingSignal[] = [];
  const filter = options?.enabledSignals ? new Set(options.enabledSignals) : null;

  const push = (s: CoachingSignal) => {
    if (!filter || filter.has(s.type)) signals.push(s);
  };

  // --- RSI ---
  detectRsiSignals(slice, curr, prev, push);

  // --- MACD ---
  detectMacdSignals(slice, curr, prev, push);

  // --- Bollinger Bands ---
  detectBbSignals(slice, curr, prev, push);

  // --- MA Cross ---
  detectMaCrossSignals(slice, curr, prev, opts, push);

  // --- DMI/ADX ---
  detectDmiSignals(slice, curr, prev, push);

  // --- Stochastics ---
  detectStochSignals(slice, curr, prev, push);

  // --- Volume Spike ---
  detectVolumeSpike(slice, curr, push);

  // --- Candlestick Patterns ---
  detectCandlestickSignals(slice, curr, push);

  // --- Supertrend ---
  detectSupertrendSignals(slice, curr, prev, push);

  return signals;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

type PushFn = (s: CoachingSignal) => void;

function detectRsiSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = rsi(candles, { period: 14 });
  const rsiCurr = series[curr]?.value;
  const rsiPrev = series[prev]?.value;
  if (rsiCurr == null || rsiPrev == null) return;

  if (rsiPrev >= 30 && rsiCurr < 30) {
    push({
      type: "RSI_OVERSOLD",
      severity: "high",
      message: "RSI oversold",
      detail: `RSI crossed below 30 (${rsiCurr.toFixed(1)}). The asset may be oversold — potential bounce opportunity.`,
      indicator: "RSI",
      direction: "bullish",
    });
  }
  if (rsiPrev <= 70 && rsiCurr > 70) {
    push({
      type: "RSI_OVERBOUGHT",
      severity: "high",
      message: "RSI overbought",
      detail: `RSI crossed above 70 (${rsiCurr.toFixed(1)}). The asset may be overbought — consider taking profits.`,
      indicator: "RSI",
      direction: "bearish",
    });
  }
  if (rsiPrev < 30 && rsiCurr >= 30) {
    push({
      type: "RSI_RECOVER_OVERSOLD",
      severity: "medium",
      message: "RSI recovering",
      detail: `RSI crossed back above 30 (${rsiCurr.toFixed(1)}). Momentum may be shifting upward.`,
      indicator: "RSI",
      direction: "bullish",
    });
  }
  if (rsiPrev > 70 && rsiCurr <= 70) {
    push({
      type: "RSI_DROP_OVERBOUGHT",
      severity: "medium",
      message: "RSI dropping",
      detail: `RSI dropped below 70 (${rsiCurr.toFixed(1)}). Momentum may be weakening.`,
      indicator: "RSI",
      direction: "bearish",
    });
  }
}

function detectMacdSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = macd(candles);
  const mc = series[curr]?.value;
  const mp = series[prev]?.value;
  if (!mc || !mp) return;
  if (mc.macd == null || mc.signal == null || mp.macd == null || mp.signal == null) return;

  if (mp.macd <= mp.signal && mc.macd > mc.signal) {
    push({
      type: "MACD_BULLISH_CROSS",
      severity: "high",
      message: "MACD bullish crossover",
      detail: "MACD line crossed above signal line. Momentum is shifting bullish.",
      indicator: "MACD",
      direction: "bullish",
    });
  }
  if (mp.macd >= mp.signal && mc.macd < mc.signal) {
    push({
      type: "MACD_BEARISH_CROSS",
      severity: "high",
      message: "MACD bearish crossover",
      detail: "MACD line crossed below signal line. Momentum is shifting bearish.",
      indicator: "MACD",
      direction: "bearish",
    });
  }
  if (mp.histogram != null && mc.histogram != null) {
    if (mp.histogram <= 0 && mc.histogram > 0) {
      push({
        type: "MACD_HIST_POSITIVE",
        severity: "low",
        message: "MACD histogram positive",
        detail: "Histogram turned positive — bullish momentum is increasing.",
        indicator: "MACD",
        direction: "bullish",
      });
    }
    if (mp.histogram >= 0 && mc.histogram < 0) {
      push({
        type: "MACD_HIST_NEGATIVE",
        severity: "low",
        message: "MACD histogram negative",
        detail: "Histogram turned negative — bearish momentum is increasing.",
        indicator: "MACD",
        direction: "bearish",
      });
    }
  }
}

function detectBbSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = bollingerBands(candles);
  const bc = series[curr]?.value;
  const bp = series[prev]?.value;
  if (!bc || !bp) return;
  if (bc.upper == null || bc.lower == null || bc.middle == null) return;
  if (bp.upper == null || bp.lower == null || bp.middle == null) return;

  const candle = candles[curr];

  // Squeeze detection
  const bwCurr = (bc.upper - bc.lower) / bc.middle;
  const bwPrev = (bp.upper - bp.lower) / bp.middle;
  if (bwCurr < 0.04 && bwPrev >= 0.04) {
    push({
      type: "BB_SQUEEZE",
      severity: "medium",
      message: "Bollinger squeeze",
      detail: `Bands are very tight (BW: ${(bwCurr * 100).toFixed(1)}%). A breakout may be imminent.`,
      indicator: "BB",
      direction: "info",
    });
  }

  if (candle.close >= bc.upper) {
    push({
      type: "BB_UPPER_TOUCH",
      severity: "low",
      message: "Price at upper BB",
      detail: "Price reached the upper Bollinger Band — could be extended.",
      indicator: "BB",
      direction: "bearish",
    });
  }
  if (candle.close <= bc.lower) {
    push({
      type: "BB_LOWER_TOUCH",
      severity: "low",
      message: "Price at lower BB",
      detail: "Price reached the lower Bollinger Band — potential support.",
      indicator: "BB",
      direction: "bullish",
    });
  }
}

function detectMaCrossSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  opts: { smaShort: number; smaLong: number },
  push: PushFn,
): void {
  const shortSeries = sma(candles, { period: opts.smaShort });
  const longSeries = sma(candles, { period: opts.smaLong });

  const shortCurr = shortSeries[curr]?.value;
  const shortPrev = shortSeries[prev]?.value;
  const longCurr = longSeries[curr]?.value;
  const longPrev = longSeries[prev]?.value;

  if (shortCurr == null || shortPrev == null || longCurr == null || longPrev == null) return;

  if (shortPrev <= longPrev && shortCurr > longCurr) {
    push({
      type: "GOLDEN_CROSS",
      severity: "high",
      message: "Golden Cross",
      detail: `SMA${opts.smaShort} crossed above SMA${opts.smaLong}. This is a classic bullish signal.`,
      indicator: "MA",
      direction: "bullish",
    });
  }
  if (shortPrev >= longPrev && shortCurr < longCurr) {
    push({
      type: "DEATH_CROSS",
      severity: "high",
      message: "Death Cross",
      detail: `SMA${opts.smaShort} crossed below SMA${opts.smaLong}. This is a classic bearish signal.`,
      indicator: "MA",
      direction: "bearish",
    });
  }
}

function detectDmiSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = dmi(candles, { period: 14 });
  const dc = series[curr]?.value;
  const dp = series[prev]?.value;
  if (!dc || !dp) return;
  if (dc.plusDi == null || dc.minusDi == null || dp.plusDi == null || dp.minusDi == null) return;
  const adx = dc.adx ?? 0;

  if (dp.plusDi <= dp.minusDi && dc.plusDi > dc.minusDi) {
    push({
      type: "DMI_BULLISH_CROSS",
      severity: adx > 25 ? "high" : "medium",
      message: "DMI bullish cross",
      detail: `+DI crossed above -DI (ADX: ${adx.toFixed(1)}). Trend direction is shifting bullish.`,
      indicator: "DMI",
      direction: "bullish",
    });
  }
  if (dp.minusDi <= dp.plusDi && dc.minusDi > dc.plusDi) {
    push({
      type: "DMI_BEARISH_CROSS",
      severity: adx > 25 ? "high" : "medium",
      message: "DMI bearish cross",
      detail: `-DI crossed above +DI (ADX: ${adx.toFixed(1)}). Trend direction is shifting bearish.`,
      indicator: "DMI",
      direction: "bearish",
    });
  }
}

function detectStochSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = stochastics(candles);
  const sc = series[curr]?.value;
  const sp = series[prev]?.value;
  if (!sc || !sp) return;
  if (sc.k == null || sc.d == null || sp.k == null || sp.d == null) return;

  if (sp.k <= sp.d && sc.k > sc.d && sc.k < 20) {
    push({
      type: "STOCH_BULLISH_OVERSOLD",
      severity: "high",
      message: "Stoch bullish cross (oversold)",
      detail: `%K crossed above %D in oversold zone (${sc.k.toFixed(1)}). Strong buy signal.`,
      indicator: "Stochastics",
      direction: "bullish",
    });
  }
  if (sp.k >= sp.d && sc.k < sc.d && sc.k > 80) {
    push({
      type: "STOCH_BEARISH_OVERBOUGHT",
      severity: "high",
      message: "Stoch bearish cross (overbought)",
      detail: `%K crossed below %D in overbought zone (${sc.k.toFixed(1)}). Strong sell signal.`,
      indicator: "Stochastics",
      direction: "bearish",
    });
  }
}

function detectVolumeSpike(candles: NormalizedCandle[], curr: number, push: PushFn): void {
  if (curr < 20) return;

  let volSum = 0;
  for (let i = curr - 20; i < curr; i++) {
    volSum += candles[i].volume;
  }
  const avgVol = volSum / 20;
  const ratio = candles[curr].volume / avgVol;

  if (ratio > 2) {
    push({
      type: "VOLUME_SPIKE",
      severity: ratio > 3 ? "high" : "medium",
      message: `Volume spike (${ratio.toFixed(1)}x)`,
      detail: `Volume is ${ratio.toFixed(1)}x the 20-period average. Significant institutional interest or news may be driving this.`,
      indicator: "Volume",
      direction: "info",
    });
  }
}

function detectCandlestickSignals(candles: NormalizedCandle[], curr: number, push: PushFn): void {
  if (curr < 1) return;

  const candle = candles[curr];
  const prevCandle = candles[curr - 1];

  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  // Doji
  if (range > 0 && body / range < 0.1) {
    push({
      type: "CANDLE_DOJI",
      severity: "low",
      message: "Doji candle",
      detail: "A Doji indicates indecision. Watch for direction confirmation in the next candle.",
      indicator: "Candlestick",
      direction: "info",
    });
  }

  // Hammer
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  if (range > 0 && lowerShadow > body * 2 && upperShadow < body * 0.5) {
    push({
      type: "CANDLE_HAMMER",
      severity: "medium",
      message: "Hammer pattern",
      detail:
        "A Hammer with a long lower shadow suggests buying pressure. Potential reversal from downtrend.",
      indicator: "Candlestick",
      direction: "bullish",
    });
  }

  // Bullish engulfing
  if (
    prevCandle.close < prevCandle.open &&
    candle.close > candle.open &&
    candle.open <= prevCandle.close &&
    candle.close >= prevCandle.open
  ) {
    push({
      type: "CANDLE_BULLISH_ENGULFING",
      severity: "medium",
      message: "Bullish engulfing",
      detail: "A bullish candle fully engulfs the previous bearish candle. Reversal pattern.",
      indicator: "Candlestick",
      direction: "bullish",
    });
  }

  // Bearish engulfing
  if (
    prevCandle.close > prevCandle.open &&
    candle.close < candle.open &&
    candle.open >= prevCandle.close &&
    candle.close <= prevCandle.open
  ) {
    push({
      type: "CANDLE_BEARISH_ENGULFING",
      severity: "medium",
      message: "Bearish engulfing",
      detail: "A bearish candle fully engulfs the previous bullish candle. Reversal pattern.",
      indicator: "Candlestick",
      direction: "bearish",
    });
  }
}

function detectSupertrendSignals(
  candles: NormalizedCandle[],
  curr: number,
  prev: number,
  push: PushFn,
): void {
  const series = supertrend(candles);
  const stCurr = series[curr]?.value;
  const stPrev = series[prev]?.value;
  if (!stCurr || !stPrev) return;

  if (stCurr.direction !== stPrev.direction) {
    if (stCurr.direction === 1) {
      push({
        type: "SUPERTREND_BULLISH",
        severity: "high",
        message: "Supertrend flipped bullish",
        detail: "Supertrend changed to uptrend. This is a trend-following buy signal.",
        indicator: "Supertrend",
        direction: "bullish",
      });
    } else {
      push({
        type: "SUPERTREND_BEARISH",
        severity: "high",
        message: "Supertrend flipped bearish",
        detail: "Supertrend changed to downtrend. This is a trend-following sell signal.",
        indicator: "Supertrend",
        direction: "bearish",
      });
    }
  }
}
