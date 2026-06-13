/**
 * Shared step-price candle fixtures for backtest integration tests.
 */

import type { ConditionFn, NormalizedCandle } from "../../types";

/**
 * Step-price candles: a flat segment per step, with open=close=price and a
 * ±1 high/low band. Flat segments keep ATR exactly 2 (TR = high-low = 2),
 * making sizing/risk arithmetic in assertions exact.
 */
export function stepCandles(
  steps: { price: number; bars: number }[],
  volume = 1_000_000,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let t = 1_700_000_000_000;
  for (const s of steps) {
    for (let i = 0; i < s.bars; i++) {
      candles.push({
        time: t,
        open: s.price,
        high: s.price + 1,
        low: s.price - 1,
        close: s.price,
        volume,
      });
      t += 86_400_000;
    }
  }
  return candles;
}

/** Condition firing exactly at the given bar indices */
export const at =
  (...indices: number[]): ConditionFn =>
  (_ind, _candle, i) =>
    indices.includes(i);

/** Condition that never fires */
export const never: ConditionFn = () => false;
