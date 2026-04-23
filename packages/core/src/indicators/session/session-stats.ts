/**
 * Session Statistics
 *
 * Computes per-session aggregate statistics (average range, volume,
 * bullish percentage) over a configurable lookback period.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle } from "../../types";
import {
  type SessionDefinition,
  getIctSessions,
  isInAnyBreak,
  isInSessionWindow,
} from "./session-definition";
import { getTzHourMinute } from "./tz-utils";

/**
 * Options for sessionStats
 */
export type SessionStatsOptions = {
  /** Session definitions (default: ICT sessions) */
  sessions?: SessionDefinition[];
  /** Lookback period in sessions (default: 20) */
  lookback?: number;
};

/**
 * Per-session aggregate statistics
 */
export type SessionStatsValue = {
  /** Session name */
  session: string;
  /** Average range (high - low) per session occurrence */
  avgRange: number;
  /** Average total volume per session occurrence */
  avgVolume: number;
  /** Percentage of bullish bars (close > open) */
  bullishPercent: number;
  /** Total bar count across all occurrences in the lookback */
  barCount: number;
};

type SessionOccurrence = {
  high: number;
  low: number;
  totalVolume: number;
  bullishBars: number;
  totalBars: number;
};

/**
 * Compute per-session statistics over the lookback period.
 *
 * For each defined session:
 * - Average range (high - low) per session occurrence
 * - Average total volume per session occurrence
 * - Bullish percentage (close > open bars / total bars)
 * - Bar count
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Session stats options
 * @returns Array of per-session statistics
 *
 * @example
 * ```ts
 * import { sessionStats } from "trendcraft";
 *
 * const stats = sessionStats(candles, { lookback: 20 });
 * stats.forEach(s => {
 *   console.log(`${s.session}: avgRange=${s.avgRange.toFixed(2)} bullish=${(s.bullishPercent * 100).toFixed(0)}%`);
 * });
 * ```
 */
export function sessionStats(
  candles: Candle[] | NormalizedCandle[],
  options?: SessionStatsOptions,
): SessionStatsValue[] {
  if (candles.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const sessionDefs = options?.sessions ?? getIctSessions();
  const lookback = options?.lookback ?? 20;

  // Build occurrences per session
  const occurrences = new Map<string, SessionOccurrence[]>();
  for (const session of sessionDefs) {
    occurrences.set(session.name, []);
  }

  // Track current occurrence per session
  const currentOcc = new Map<string, SessionOccurrence | null>();
  const prevSession = new Map<string, boolean>();

  for (const session of sessionDefs) {
    currentOcc.set(session.name, null);
    prevSession.set(session.name, false);
  }

  for (const candle of normalized) {
    for (const session of sessionDefs) {
      const { hour, minute } = getTzHourMinute(candle.time, session.timezone);
      // Use the outer window for occurrence boundary detection, so a lunch break
      // does not split one session into two occurrences.
      const inWindow = isInSessionWindow(hour, minute, session);
      const inBreak =
        inWindow && session.breaks !== undefined && isInAnyBreak(hour, minute, session.breaks);
      const wasInWindow = prevSession.get(session.name) ?? false;

      if (inWindow) {
        if (!wasInWindow) {
          // New session occurrence starts. Seed with this bar unless it is in a break.
          const occ: SessionOccurrence = inBreak
            ? {
                high: Number.NEGATIVE_INFINITY,
                low: Number.POSITIVE_INFINITY,
                totalVolume: 0,
                bullishBars: 0,
                totalBars: 0,
              }
            : {
                high: candle.high,
                low: candle.low,
                totalVolume: candle.volume,
                bullishBars: candle.close > candle.open ? 1 : 0,
                totalBars: 1,
              };
          currentOcc.set(session.name, occ);
        } else if (!inBreak) {
          // Continue current occurrence — skip break bars entirely.
          const occ = currentOcc.get(session.name);
          if (!occ) continue;
          occ.high = Math.max(occ.high, candle.high);
          occ.low = Math.min(occ.low, candle.low);
          occ.totalVolume += candle.volume;
          if (candle.close > candle.open) occ.bullishBars++;
          occ.totalBars++;
        }
        // if inBreak && wasInWindow: do nothing (preserve occurrence through break)
      } else if (wasInWindow) {
        // Session window just ended — finalize occurrence if any real bars collected.
        const occ = currentOcc.get(session.name);
        if (occ && occ.totalBars > 0) {
          occurrences.get(session.name)?.push(occ);
        }
        currentOcc.set(session.name, null);
      }

      prevSession.set(session.name, inWindow);
    }
  }

  // Finalize any still-open sessions
  for (const session of sessionDefs) {
    const occ = currentOcc.get(session.name);
    if (occ && occ.totalBars > 0) {
      occurrences.get(session.name)?.push(occ);
    }
  }

  // Compute stats per session using only the last `lookback` occurrences
  const results: SessionStatsValue[] = [];

  for (const session of sessionDefs) {
    const allOcc = occurrences.get(session.name) ?? [];
    const recentOcc = allOcc.slice(-lookback);

    if (recentOcc.length === 0) {
      results.push({
        session: session.name,
        avgRange: 0,
        avgVolume: 0,
        bullishPercent: 0,
        barCount: 0,
      });
      continue;
    }

    let totalRange = 0;
    let totalVolume = 0;
    let totalBullish = 0;
    let totalBars = 0;

    for (const occ of recentOcc) {
      totalRange += occ.high - occ.low;
      totalVolume += occ.totalVolume;
      totalBullish += occ.bullishBars;
      totalBars += occ.totalBars;
    }

    results.push({
      session: session.name,
      avgRange: totalRange / recentOcc.length,
      avgVolume: totalVolume / recentOcc.length,
      bullishPercent: totalBars > 0 ? totalBullish / totalBars : 0,
      barCount: totalBars,
    });
  }

  return results;
}
