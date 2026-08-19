/**
 * Drawdown Period Tracker
 *
 * Tracks individual drawdown periods during backtesting,
 * recording peak-to-trough-to-recovery for each drawdown.
 *
 * The tracker is the single owner of every drawdown figure a backtest
 * reports. Both engines hand it their finished equity curve via {@link
 * drawdownFromEquityCurve}, so `maxDrawdown` and `drawdownPeriods` are a
 * function of the `equityCurve` the same result carries and cannot
 * contradict it.
 */

import type { DrawdownPeriod } from "../types";

/**
 * Drawdown tracker state machine
 */
export type DrawdownTracker = {
  /**
   * Update tracker with the account's current equity — cash plus the
   * mark-to-market value of anything still open, never cash alone.
   */
  update(equity: number, time: number, barIndex: number): void;
  /** Finalize any open drawdown period at end of backtest */
  finalize(time: number, barIndex: number): void;
  /** Get all completed and in-progress drawdown periods */
  getPeriods(): DrawdownPeriod[];
  /**
   * Deepest peak-to-trough decline seen so far, in percent. Equal to the
   * largest `maxDepthPercent` across {@link getPeriods}, by construction.
   */
  getMaxDepthPercent(): number;
};

/**
 * Create a drawdown tracker to monitor equity drawdown periods
 *
 * @param initialCapital - Starting capital
 * @returns DrawdownTracker instance
 *
 * @example
 * ```ts
 * const tracker = createDrawdownTracker(1_000_000);
 * tracker.update(950_000, timestamp, 10);  // drawdown starts
 * tracker.update(1_050_000, timestamp, 20); // recovery
 * tracker.finalize(timestamp, 50);
 * const periods = tracker.getPeriods();
 * const worst = tracker.getMaxDepthPercent(); // 5
 * ```
 */
export function createDrawdownTracker(initialCapital: number): DrawdownTracker {
  let peak = initialCapital;
  let peakTime = 0;
  let peakBar = 0;

  // Current drawdown state (null if not in drawdown)
  let currentDD: {
    startTime: number;
    startBar: number;
    peakEquity: number;
    troughEquity: number;
    troughTime: number;
    troughBar: number;
  } | null = null;

  const periods: DrawdownPeriod[] = [];
  let maxDepthPercent = 0;

  /**
   * Peak-to-trough decline as a percentage of the peak. A non-positive peak
   * (a wiped-out or negative account) has no meaningful percentage, so it
   * reports 0 rather than a sign-flipped or infinite figure.
   */
  function depthPercent(peakEquity: number, troughEquity: number): number {
    if (peakEquity <= 0) return 0;
    return ((peakEquity - troughEquity) / peakEquity) * 100;
  }

  function update(equity: number, time: number, barIndex: number): void {
    if (equity >= peak) {
      // Recovered or new high
      if (currentDD !== null) {
        // Close the drawdown period
        periods.push({
          startTime: currentDD.startTime,
          peakEquity: currentDD.peakEquity,
          troughTime: currentDD.troughTime,
          troughEquity: currentDD.troughEquity,
          recoveryTime: time,
          maxDepthPercent:
            Math.round(depthPercent(currentDD.peakEquity, currentDD.troughEquity) * 100) / 100,
          durationBars: barIndex - currentDD.startBar,
          recoveryBars: barIndex - currentDD.troughBar,
        });
        currentDD = null;
      }
      peak = equity;
      peakTime = time;
      peakBar = barIndex;
    } else {
      // In drawdown
      if (currentDD === null) {
        // Start new drawdown
        currentDD = {
          startTime: peakTime,
          startBar: peakBar,
          peakEquity: peak,
          troughEquity: equity,
          troughTime: time,
          troughBar: barIndex,
        };
      } else if (equity < currentDD.troughEquity) {
        // Deeper drawdown
        currentDD.troughEquity = equity;
        currentDD.troughTime = time;
        currentDD.troughBar = barIndex;
      }
      const depth = depthPercent(currentDD.peakEquity, currentDD.troughEquity);
      if (depth > maxDepthPercent) {
        maxDepthPercent = depth;
      }
    }
  }

  function finalize(_time: number, barIndex: number): void {
    if (currentDD !== null) {
      // Close open drawdown without recovery
      periods.push({
        startTime: currentDD.startTime,
        peakEquity: currentDD.peakEquity,
        troughTime: currentDD.troughTime,
        troughEquity: currentDD.troughEquity,
        maxDepthPercent:
          Math.round(depthPercent(currentDD.peakEquity, currentDD.troughEquity) * 100) / 100,
        durationBars: barIndex - currentDD.startBar,
      });
      currentDD = null;
    }
  }

  function getPeriods(): DrawdownPeriod[] {
    return [...periods];
  }

  function getMaxDepthPercent(): number {
    return maxDepthPercent;
  }

  return { update, finalize, getPeriods, getMaxDepthPercent };
}

/**
 * Derive a backtest's drawdown figures from its finished equity curve.
 *
 * Drawdown is a property of the equity path, so this takes the very series
 * the result reports rather than re-deriving one. Measuring cash instead —
 * which is 0 while a position is open and jumps to the realized slice on a
 * partial exit — reads a partial take profit as a catastrophic loss and a
 * decline taken while fully invested as no loss at all.
 *
 * @param equityCurve - Account equity at each candle's close, index-aligned
 *   with `candles`. Its first element is the starting capital.
 * @param candles - The candles the backtest ran on, for period timestamps
 * @returns The deepest decline in percent and every drawdown period in it
 *
 * @example
 * ```ts
 * const equity = [1_000_000, 900_000, 1_100_000];
 * const bars = equity.map((_, i) => ({ time: i * 86_400_000 }));
 * const { maxDrawdown } = drawdownFromEquityCurve(equity, bars); // 10
 * ```
 */
export function drawdownFromEquityCurve(
  equityCurve: number[],
  candles: { time: number }[],
): { maxDrawdown: number; periods: DrawdownPeriod[] } {
  if (equityCurve.length === 0) {
    return { maxDrawdown: 0, periods: [] };
  }

  const tracker = createDrawdownTracker(equityCurve[0]);
  for (let i = 0; i < equityCurve.length; i++) {
    tracker.update(equityCurve[i], candles[i].time, i);
  }
  const lastIndex = equityCurve.length - 1;
  tracker.finalize(candles[lastIndex].time, lastIndex);

  return { maxDrawdown: tracker.getMaxDepthPercent(), periods: tracker.getPeriods() };
}
