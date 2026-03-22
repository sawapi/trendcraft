/**
 * Drawdown Period Tracker
 *
 * Tracks individual drawdown periods during backtesting,
 * recording peak-to-trough-to-recovery for each drawdown.
 */

import type { DrawdownPeriod } from "../types";

/**
 * Drawdown tracker state machine
 */
export type DrawdownTracker = {
  /** Update tracker with current equity state */
  update(capital: number, time: number, barIndex: number): void;
  /** Finalize any open drawdown period at end of backtest */
  finalize(time: number, barIndex: number): void;
  /** Get all completed and in-progress drawdown periods */
  getPeriods(): DrawdownPeriod[];
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

  function update(capital: number, time: number, barIndex: number): void {
    if (capital >= peak) {
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
            Math.round(
              ((currentDD.peakEquity - currentDD.troughEquity) / currentDD.peakEquity) * 100 * 100,
            ) / 100,
          durationBars: barIndex - currentDD.startBar,
          recoveryBars: barIndex - currentDD.troughBar,
        });
        currentDD = null;
      }
      peak = capital;
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
          troughEquity: capital,
          troughTime: time,
          troughBar: barIndex,
        };
      } else if (capital < currentDD.troughEquity) {
        // Deeper drawdown
        currentDD.troughEquity = capital;
        currentDD.troughTime = time;
        currentDD.troughBar = barIndex;
      }
    }
  }

  function finalize(time: number, barIndex: number): void {
    if (currentDD !== null) {
      // Close open drawdown without recovery
      periods.push({
        startTime: currentDD.startTime,
        peakEquity: currentDD.peakEquity,
        troughTime: currentDD.troughTime,
        troughEquity: currentDD.troughEquity,
        maxDepthPercent:
          Math.round(
            ((currentDD.peakEquity - currentDD.troughEquity) / currentDD.peakEquity) * 100 * 100,
          ) / 100,
        durationBars: barIndex - currentDD.startBar,
      });
      currentDD = null;
    }
  }

  function getPeriods(): DrawdownPeriod[] {
    return [...periods];
  }

  return { update, finalize, getPeriods };
}
