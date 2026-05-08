import {
  calculateScoreBreakdown,
  calculateScoreSeries,
  getPreset,
  normalizeCandles,
  type ScoreBreakdown,
  type ScoreResult,
  type ScoringPreset,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

export const SCORING_PRESETS: ReadonlyArray<{ id: ScoringPreset; label: string }> = [
  { id: "momentum", label: "Momentum" },
  { id: "meanReversion", label: "Mean Rev" },
  { id: "trendFollowing", label: "Trend" },
  { id: "balanced", label: "Balanced" },
  { id: "aggressive", label: "Aggressive" },
  { id: "conservative", label: "Conservative" },
];

export type ScoringComputation =
  | {
      kind: "ok";
      series: Array<{ time: number; score: ScoreResult }>;
      breakdown: ScoreBreakdown;
    }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

/**
 * Wrap core's `calculateScoreSeries` + `calculateScoreBreakdown` so the panel
 * deals with one discriminated union instead of two parallel calls. The
 * series spans the full candle slice and the breakdown is for the *last*
 * bar — what the panel renders for "current setup quality".
 *
 * Pure: same `(candles, presetName)` always produces the same shape, no I/O,
 * no Math.random. Replay-aware behavior lives one layer up (the panel
 * stops calling this while playback is running).
 */
export function runScoring(candles: StudioCandle[], presetName: ScoringPreset): ScoringComputation {
  if (candles.length < 2) {
    return { kind: "empty", message: "Need at least 2 bars to score" };
  }
  try {
    const config = getPreset(presetName);
    const normalized = normalizeCandles(candles);
    const series = calculateScoreSeries(normalized, config);
    const breakdown = calculateScoreBreakdown(normalized, normalized.length - 1, config);
    return { kind: "ok", series, breakdown };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
