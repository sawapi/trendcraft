import {
  type PositionSizeResult,
  type Trade,
  type VarMethod,
  type VarResult,
  atr,
  atrBasedSize,
  calculateVaR,
  kellySize,
  returns,
  riskBasedSize,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

export type SizingMethod = "risk-based" | "atr-based" | "kelly";

export type SizingInputs = {
  method: SizingMethod;
  accountSize: number;
  entryPrice: number;
  /** Risk-based / ATR: % of account at risk per trade. */
  riskPercent: number;
  /** Risk-based: explicit stop-loss price. */
  stopLossPrice?: number;
  /** ATR: multiplier on the latest ATR(period) to set stop distance. */
  atrPeriod: number;
  atrMultiplier: number;
  /** Kelly: win rate (0–1) and avgWin/avgLoss ratio. */
  winRate: number;
  winLossRatio: number;
  kellyFraction: number;
};

export type SizingComputation =
  | { kind: "ok"; result: PositionSizeResult; atrValue?: number }
  | { kind: "error"; message: string };

// Returns null if the slice is shorter than `period + 1`: TR[0] is undefined
// because it depends on the previous close, so atr needs `period+1` candles.
// Past warm-up, atr() guarantees a finite tail value — Wilder's smoothing
// is fully defined from index `period` onward.
export function latestAtr(candles: StudioCandle[], period: number): number | null {
  if (candles.length <= period) return null;
  const series = atr(candles, { period });
  return series[series.length - 1]?.value ?? null;
}

// Use `returnPercent` (size-independent) rather than `return` (dollar P/L) so
// scaled entries / partial exits / variable position sizing don't let larger
// notionals dominate the avgWin/avgLoss ratio Kelly depends on. Partial exits
// are folded in alongside full exits — Kelly is sensitive to the realised
// payoff distribution, not just fully-closed trades.
export function deriveKellyStats(trades: readonly Trade[]): {
  winRate: number;
  winLossRatio: number;
  sampleSize: number;
} | null {
  if (trades.length === 0) return null;
  let wins = 0;
  let losses = 0;
  let winSum = 0;
  let lossSum = 0;
  for (const t of trades) {
    const pct = t.returnPercent;
    if (pct > 0) {
      wins += 1;
      winSum += pct;
    } else if (pct < 0) {
      losses += 1;
      lossSum += -pct;
    }
  }
  const decided = wins + losses;
  if (decided === 0) return null;
  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? lossSum / losses : 0;
  // No realised losses → ratio is undefined; fall back to a large but finite
  // proxy so the UI can still surface a Kelly result rather than blank out.
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : Math.max(avgWin, 1);
  return {
    winRate: wins / decided,
    winLossRatio,
    sampleSize: decided,
  };
}

export function defaultSizingInputs(entryPrice: number): SizingInputs {
  return {
    method: "risk-based",
    accountSize: 100_000,
    entryPrice,
    riskPercent: 1,
    stopLossPrice: Math.max(0.01, entryPrice * 0.95),
    atrPeriod: 14,
    atrMultiplier: 2,
    winRate: 0.55,
    winLossRatio: 1.5,
    kellyFraction: 0.5,
  };
}

export function computeSizing(inputs: SizingInputs, candles: StudioCandle[]): SizingComputation {
  try {
    if (inputs.method === "risk-based") {
      const stop = inputs.stopLossPrice;
      if (stop === undefined || !Number.isFinite(stop)) {
        return { kind: "error", message: "Stop-loss price required" };
      }
      const result = riskBasedSize({
        accountSize: inputs.accountSize,
        entryPrice: inputs.entryPrice,
        riskPercent: inputs.riskPercent,
        stopLossPrice: stop,
      });
      return { kind: "ok", result };
    }
    if (inputs.method === "atr-based") {
      const atrValue = latestAtr(candles, inputs.atrPeriod);
      if (atrValue == null) {
        return {
          kind: "error",
          message: `Need ${inputs.atrPeriod + 1}+ bars in slice for ATR(${inputs.atrPeriod})`,
        };
      }
      const result = atrBasedSize({
        accountSize: inputs.accountSize,
        entryPrice: inputs.entryPrice,
        riskPercent: inputs.riskPercent,
        atrValue,
        atrMultiplier: inputs.atrMultiplier,
      });
      return { kind: "ok", result, atrValue };
    }
    const result = kellySize({
      accountSize: inputs.accountSize,
      entryPrice: inputs.entryPrice,
      winRate: inputs.winRate,
      winLossRatio: inputs.winLossRatio,
      kellyFraction: inputs.kellyFraction,
    });
    return { kind: "ok", result };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export type VarInputs = {
  method: VarMethod;
  confidence: number;
  /** Lookback in bars used to derive returns (last N closes → N-1 returns). */
  lookback: number;
};

export const DEFAULT_VAR_INPUTS: VarInputs = {
  method: "historical",
  confidence: 0.95,
  lookback: 120,
};

export type VarComputation =
  | { kind: "ok"; result: VarResult; returnsCount: number }
  | { kind: "error"; message: string };

/**
 * Last `lookback` simple returns, dropping the first null slot from `returns()`
 * and any null produced by zero/negative closes.
 */
export function returnsFromCloses(candles: StudioCandle[], lookback: number): number[] {
  const slice = candles.slice(-lookback);
  const out: number[] = [];
  for (const point of returns(slice)) {
    if (point.value != null && Number.isFinite(point.value)) out.push(point.value);
  }
  return out;
}

export function computeVar(inputs: VarInputs, candles: StudioCandle[]): VarComputation {
  if (inputs.confidence <= 0 || inputs.confidence >= 1) {
    return { kind: "error", message: "Confidence must be in (0, 1)" };
  }
  const returns = returnsFromCloses(candles, inputs.lookback);
  if (returns.length < 10) {
    return { kind: "error", message: `Need ≥10 returns (got ${returns.length})` };
  }
  try {
    const result = calculateVaR(returns, {
      confidence: inputs.confidence,
      method: inputs.method,
    });
    return { kind: "ok", result, returnsCount: returns.length };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export type { PositionSizeResult, VarMethod, VarResult };
