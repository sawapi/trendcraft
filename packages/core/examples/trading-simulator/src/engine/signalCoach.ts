/**
 * Signal Coaching Engine
 *
 * Detects real-time coaching signals from the latest candle + indicator snapshot.
 * Returns human-readable hints for the trading simulator.
 */

import type { NormalizedCandle } from "trendcraft";
import type { IndicatorData } from "../utils/indicators";

export type SignalDirection = "bullish" | "bearish" | "info";
export type SignalSeverity = "high" | "medium" | "low";

export interface CoachingSignal {
  type: string;
  severity: SignalSeverity;
  message: string;
  detail: string;
  indicator: string;
  direction: SignalDirection;
}

export type CoachingLevel = "beginner" | "intermediate" | "advanced";

/**
 * Detect coaching signals from current candle and indicator state.
 * Called after each stepForward.
 */
export function detectCoachingSignals(
  candles: NormalizedCandle[],
  currentIndex: number,
  indicatorData: IndicatorData,
): CoachingSignal[] {
  if (currentIndex < 2) return [];

  const signals: CoachingSignal[] = [];
  const curr = currentIndex;
  const prev = currentIndex - 1;

  // === RSI Signals ===
  if (indicatorData.rsi) {
    const rsiCurr = indicatorData.rsi[curr];
    const rsiPrev = indicatorData.rsi[prev];

    if (rsiCurr != null && rsiPrev != null) {
      // RSI crosses below 30
      if (rsiPrev >= 30 && rsiCurr < 30) {
        signals.push({
          type: "RSI_OVERSOLD",
          severity: "high",
          message: "RSI oversold",
          detail: `RSI crossed below 30 (${rsiCurr.toFixed(1)}). The asset may be oversold — potential bounce opportunity.`,
          indicator: "RSI",
          direction: "bullish",
        });
      }
      // RSI crosses above 70
      if (rsiPrev <= 70 && rsiCurr > 70) {
        signals.push({
          type: "RSI_OVERBOUGHT",
          severity: "high",
          message: "RSI overbought",
          detail: `RSI crossed above 70 (${rsiCurr.toFixed(1)}). The asset may be overbought — consider taking profits.`,
          indicator: "RSI",
          direction: "bearish",
        });
      }
      // RSI recovering from oversold
      if (rsiPrev < 30 && rsiCurr >= 30) {
        signals.push({
          type: "RSI_RECOVER_OVERSOLD",
          severity: "medium",
          message: "RSI recovering",
          detail: `RSI crossed back above 30 (${rsiCurr.toFixed(1)}). Momentum may be shifting upward.`,
          indicator: "RSI",
          direction: "bullish",
        });
      }
      // RSI dropping from overbought
      if (rsiPrev > 70 && rsiCurr <= 70) {
        signals.push({
          type: "RSI_DROP_OVERBOUGHT",
          severity: "medium",
          message: "RSI dropping",
          detail: `RSI dropped below 70 (${rsiCurr.toFixed(1)}). Momentum may be weakening.`,
          indicator: "RSI",
          direction: "bearish",
        });
      }
    }
  }

  // === MACD Signals ===
  if (indicatorData.macdLine && indicatorData.macdSignal) {
    const macdCurr = indicatorData.macdLine[curr];
    const macdPrev = indicatorData.macdLine[prev];
    const sigCurr = indicatorData.macdSignal[curr];
    const sigPrev = indicatorData.macdSignal[prev];

    if (macdCurr != null && macdPrev != null && sigCurr != null && sigPrev != null) {
      // Bullish crossover
      if (macdPrev <= sigPrev && macdCurr > sigCurr) {
        signals.push({
          type: "MACD_BULLISH_CROSS",
          severity: "high",
          message: "MACD bullish crossover",
          detail: "MACD line crossed above signal line. Momentum is shifting bullish.",
          indicator: "MACD",
          direction: "bullish",
        });
      }
      // Bearish crossover
      if (macdPrev >= sigPrev && macdCurr < sigCurr) {
        signals.push({
          type: "MACD_BEARISH_CROSS",
          severity: "high",
          message: "MACD bearish crossover",
          detail: "MACD line crossed below signal line. Momentum is shifting bearish.",
          indicator: "MACD",
          direction: "bearish",
        });
      }
      // MACD histogram zero cross
      const histCurr = indicatorData.macdHist?.[curr];
      const histPrev = indicatorData.macdHist?.[prev];
      if (histCurr != null && histPrev != null) {
        if (histPrev <= 0 && histCurr > 0) {
          signals.push({
            type: "MACD_HIST_POSITIVE",
            severity: "low",
            message: "MACD histogram positive",
            detail: "Histogram turned positive — bullish momentum is increasing.",
            indicator: "MACD",
            direction: "bullish",
          });
        }
        if (histPrev >= 0 && histCurr < 0) {
          signals.push({
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
  }

  // === Bollinger Bands Signals ===
  if (indicatorData.bbUpper && indicatorData.bbLower && indicatorData.bbMiddle) {
    const candle = candles[curr];
    const upper = indicatorData.bbUpper[curr];
    const lower = indicatorData.bbLower[curr];
    const middle = indicatorData.bbMiddle[curr];
    const prevUpper = indicatorData.bbUpper[prev];
    const prevLower = indicatorData.bbLower[prev];

    if (upper != null && lower != null && middle != null && candle) {
      // Squeeze detection (bandwidth narrowing)
      if (prevUpper != null && prevLower != null) {
        const bwCurr = (upper - lower) / middle;
        const bwPrev = (prevUpper - prevLower) / middle;
        if (bwCurr < 0.04 && bwPrev >= 0.04) {
          signals.push({
            type: "BB_SQUEEZE",
            severity: "medium",
            message: "Bollinger squeeze",
            detail: `Bands are very tight (BW: ${(bwCurr * 100).toFixed(1)}%). A breakout may be imminent.`,
            indicator: "BB",
            direction: "info",
          });
        }
      }

      // Price touching upper band
      if (candle.close >= upper) {
        signals.push({
          type: "BB_UPPER_TOUCH",
          severity: "low",
          message: "Price at upper BB",
          detail: "Price reached the upper Bollinger Band — could be extended.",
          indicator: "BB",
          direction: "bearish",
        });
      }
      // Price touching lower band
      if (candle.close <= lower) {
        signals.push({
          type: "BB_LOWER_TOUCH",
          severity: "low",
          message: "Price at lower BB",
          detail: "Price reached the lower Bollinger Band — potential support.",
          indicator: "BB",
          direction: "bullish",
        });
      }
    }
  }

  // === MA Cross Signals ===
  if (indicatorData.sma25 && indicatorData.sma75) {
    const sma25Curr = indicatorData.sma25[curr];
    const sma25Prev = indicatorData.sma25[prev];
    const sma75Curr = indicatorData.sma75[curr];
    const sma75Prev = indicatorData.sma75[prev];

    if (sma25Curr != null && sma25Prev != null && sma75Curr != null && sma75Prev != null) {
      if (sma25Prev <= sma75Prev && sma25Curr > sma75Curr) {
        signals.push({
          type: "GOLDEN_CROSS",
          severity: "high",
          message: "Golden Cross",
          detail: "SMA25 crossed above SMA75. This is a classic bullish signal.",
          indicator: "MA",
          direction: "bullish",
        });
      }
      if (sma25Prev >= sma75Prev && sma25Curr < sma75Curr) {
        signals.push({
          type: "DEATH_CROSS",
          severity: "high",
          message: "Death Cross",
          detail: "SMA25 crossed below SMA75. This is a classic bearish signal.",
          indicator: "MA",
          direction: "bearish",
        });
      }
    }
  }

  // === DMI/ADX Signals ===
  if (indicatorData.dmiPlusDi && indicatorData.dmiMinusDi && indicatorData.dmiAdx) {
    const plusCurr = indicatorData.dmiPlusDi[curr];
    const plusPrev = indicatorData.dmiPlusDi[prev];
    const minusCurr = indicatorData.dmiMinusDi[curr];
    const minusPrev = indicatorData.dmiMinusDi[prev];
    const adx = indicatorData.dmiAdx[curr];

    if (plusCurr != null && plusPrev != null && minusCurr != null && minusPrev != null) {
      // DI+ crosses above DI-
      if (plusPrev <= minusPrev && plusCurr > minusCurr) {
        signals.push({
          type: "DMI_BULLISH_CROSS",
          severity: adx != null && adx > 25 ? "high" : "medium",
          message: "DMI bullish cross",
          detail: `+DI crossed above -DI${adx != null ? ` (ADX: ${adx.toFixed(1)})` : ""}. Trend direction is shifting bullish.`,
          indicator: "DMI",
          direction: "bullish",
        });
      }
      // DI- crosses above DI+
      if (minusPrev <= plusPrev && minusCurr > plusCurr) {
        signals.push({
          type: "DMI_BEARISH_CROSS",
          severity: adx != null && adx > 25 ? "high" : "medium",
          message: "DMI bearish cross",
          detail: `-DI crossed above +DI${adx != null ? ` (ADX: ${adx.toFixed(1)})` : ""}. Trend direction is shifting bearish.`,
          indicator: "DMI",
          direction: "bearish",
        });
      }
    }
  }

  // === Stochastics Signals ===
  if (indicatorData.stochK && indicatorData.stochD) {
    const kCurr = indicatorData.stochK[curr];
    const kPrev = indicatorData.stochK[prev];
    const dCurr = indicatorData.stochD[curr];
    const dPrev = indicatorData.stochD[prev];

    if (kCurr != null && kPrev != null && dCurr != null && dPrev != null) {
      // Bullish cross in oversold zone
      if (kPrev <= dPrev && kCurr > dCurr && kCurr < 20) {
        signals.push({
          type: "STOCH_BULLISH_OVERSOLD",
          severity: "high",
          message: "Stoch bullish cross (oversold)",
          detail: `%K crossed above %D in oversold zone (${kCurr.toFixed(1)}). Strong buy signal.`,
          indicator: "Stochastics",
          direction: "bullish",
        });
      }
      // Bearish cross in overbought zone
      if (kPrev >= dPrev && kCurr < dCurr && kCurr > 80) {
        signals.push({
          type: "STOCH_BEARISH_OVERBOUGHT",
          severity: "high",
          message: "Stoch bearish cross (overbought)",
          detail: `%K crossed below %D in overbought zone (${kCurr.toFixed(1)}). Strong sell signal.`,
          indicator: "Stochastics",
          direction: "bearish",
        });
      }
    }
  }

  // === Volume Spike ===
  const candle = candles[curr];
  if (candle && curr >= 20) {
    // Simple volume spike: current volume > 2x avg of last 20 candles
    let volSum = 0;
    let volCount = 0;
    for (let i = curr - 20; i < curr; i++) {
      if (candles[i]) {
        volSum += candles[i].volume;
        volCount++;
      }
    }
    if (volCount > 0) {
      const avgVol = volSum / volCount;
      if (candle.volume > avgVol * 2) {
        const ratio = candle.volume / avgVol;
        signals.push({
          type: "VOLUME_SPIKE",
          severity: ratio > 3 ? "high" : "medium",
          message: `Volume spike (${ratio.toFixed(1)}x)`,
          detail: `Volume is ${ratio.toFixed(1)}x the 20-day average. Significant institutional interest or news may be driving this.`,
          indicator: "Volume",
          direction: "info",
        });
      }
    }
  }

  // === Candlestick Patterns (simple detection) ===
  if (candle && curr >= 1) {
    const prevCandle = candles[curr - 1];
    if (prevCandle) {
      const body = Math.abs(candle.close - candle.open);
      const range = candle.high - candle.low;

      // Doji (small body relative to range)
      if (range > 0 && body / range < 0.1 && range > 0) {
        signals.push({
          type: "CANDLE_DOJI",
          severity: "low",
          message: "Doji candle",
          detail:
            "A Doji indicates indecision. Watch for direction confirmation in the next candle.",
          indicator: "Candlestick",
          direction: "info",
        });
      }

      // Hammer (long lower shadow, small body at top)
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      if (range > 0 && lowerShadow > body * 2 && upperShadow < body * 0.5) {
        signals.push({
          type: "CANDLE_HAMMER",
          severity: "medium",
          message: "Hammer pattern",
          detail:
            "A Hammer with a long lower shadow suggests buying pressure. Potential reversal from downtrend.",
          indicator: "Candlestick",
          direction: "bullish",
        });
      }

      // Engulfing bullish
      if (
        prevCandle.close < prevCandle.open && // prev is bearish
        candle.close > candle.open && // curr is bullish
        candle.open <= prevCandle.close &&
        candle.close >= prevCandle.open
      ) {
        signals.push({
          type: "CANDLE_BULLISH_ENGULFING",
          severity: "medium",
          message: "Bullish engulfing",
          detail: "A bullish candle fully engulfs the previous bearish candle. Reversal pattern.",
          indicator: "Candlestick",
          direction: "bullish",
        });
      }

      // Engulfing bearish
      if (
        prevCandle.close > prevCandle.open && // prev is bullish
        candle.close < candle.open && // curr is bearish
        candle.open >= prevCandle.close &&
        candle.close <= prevCandle.open
      ) {
        signals.push({
          type: "CANDLE_BEARISH_ENGULFING",
          severity: "medium",
          message: "Bearish engulfing",
          detail: "A bearish candle fully engulfs the previous bullish candle. Reversal pattern.",
          indicator: "Candlestick",
          direction: "bearish",
        });
      }
    }
  }

  // === Supertrend Signals ===
  if (indicatorData.supertrendDirection) {
    const dirCurr = indicatorData.supertrendDirection[curr];
    const dirPrev = indicatorData.supertrendDirection[prev];
    if (dirCurr != null && dirPrev != null && dirCurr !== dirPrev) {
      if (dirCurr === 1) {
        signals.push({
          type: "SUPERTREND_BULLISH",
          severity: "high",
          message: "Supertrend flipped bullish",
          detail: "Supertrend changed to uptrend. This is a trend-following buy signal.",
          indicator: "Supertrend",
          direction: "bullish",
        });
      } else {
        signals.push({
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

  return signals;
}
