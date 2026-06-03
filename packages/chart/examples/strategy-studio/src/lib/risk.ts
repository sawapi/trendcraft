import {
  atr,
  atrBasedSize,
  calculateVaR,
  kellySize,
  type PositionSizeResult,
  returns,
  riskBasedSize,
  type Trade,
  type VarMethod,
  type VarResult,
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

export type KellyStats = {
  winRate: number;
  winLossRatio: number;
  sampleSize: number;
  /**
   * Full-Kelly point estimate `f* = p - (1-p)/b` (clipped at 0). The
   * `kellyFraction` slider scales this down further at the UI layer.
   */
  kellyStar: number;
  /**
   * Standard error of `kellyStar` via the delta method (Sinclair 2014,
   * Journal of Investment Strategies). Treats win rate `p` (binomial,
   * `Var ≈ p(1-p)/n`) and win/loss ratio `b = avg_win / avg_loss` (ratio
   * of independent sample means) as independent, then propagates through
   * the partials `df/dp = 1 + 1/b` and `df/db = (1-p)/b^2`. `null` if
   * either side has fewer than 2 samples (sample variance is undefined).
   */
  stdError: number | null;
  /** 95% confidence interval `kellyStar ± 1.96·stdError`. `null` when `stdError` is. */
  ci95: { low: number; high: number } | null;
};

// Use `returnPercent` (size-independent) rather than `return` (dollar P/L) so
// scaled entries / partial exits / variable position sizing don't let larger
// notionals dominate the avgWin/avgLoss ratio Kelly depends on. Partial exits
// are folded in alongside full exits — Kelly is sensitive to the realised
// payoff distribution, not just fully-closed trades.
export function deriveKellyStats(trades: readonly Trade[]): KellyStats | null {
  if (trades.length === 0) return null;
  const winReturns: number[] = [];
  const lossReturns: number[] = [];
  for (const t of trades) {
    const pct = t.returnPercent;
    if (pct > 0) winReturns.push(pct);
    else if (pct < 0) lossReturns.push(-pct);
  }
  const decided = winReturns.length + lossReturns.length;
  if (decided === 0) return null;
  const wins = winReturns.length;
  const losses = lossReturns.length;
  const avgWin = wins > 0 ? winReturns.reduce((s, v) => s + v, 0) / wins : 0;
  const avgLoss = losses > 0 ? lossReturns.reduce((s, v) => s + v, 0) / losses : 0;
  // No realised losses → ratio is undefined; fall back to a large but finite
  // proxy so the UI can still surface a Kelly result rather than blank out.
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : Math.max(avgWin, 1);
  const p = wins / decided;
  const kellyStar = Math.max(0, p - (1 - p) / winLossRatio);

  let stdError: number | null = null;
  let ci95: { low: number; high: number } | null = null;
  if (wins >= 2 && losses >= 2 && avgWin > 0 && avgLoss > 0) {
    const varWin = sampleVariance(winReturns, avgWin);
    const varLoss = sampleVariance(lossReturns, avgLoss);
    const varP = (p * (1 - p)) / decided;
    // delta-method variance of b = avg_win / avg_loss, treating the two
    // sample means as independent
    const varB =
      winLossRatio *
      winLossRatio *
      (varWin / (wins * avgWin * avgWin) + varLoss / (losses * avgLoss * avgLoss));
    const dKdP = 1 + 1 / winLossRatio;
    const dKdB = (1 - p) / (winLossRatio * winLossRatio);
    const varK = dKdP * dKdP * varP + dKdB * dKdB * varB;
    if (Number.isFinite(varK) && varK >= 0) {
      stdError = Math.sqrt(varK);
      ci95 = { low: kellyStar - 1.96 * stdError, high: kellyStar + 1.96 * stdError };
    }
  }

  return {
    winRate: p,
    winLossRatio,
    sampleSize: decided,
    kellyStar,
    stdError,
    ci95,
  };
}

function sampleVariance(xs: number[], mean: number): number {
  if (xs.length < 2) return 0;
  let s = 0;
  for (const x of xs) {
    const d = x - mean;
    s += d * d;
  }
  return s / (xs.length - 1);
}

/**
 * Sample-size driven default Kelly fraction. Industry consensus
 * (MacLean–Thorp–Ziemba "Good and Bad Properties of Kelly", Van Tharp)
 * is that Full Kelly is fragile to estimation error and only safe with
 * a large sample of in-distribution trades; below 100 decided trades
 * we step down to Quarter Kelly, and never seed Full Kelly automatically.
 */
export function recommendedKellyFraction(sampleSize: number): number {
  return sampleSize >= 100 ? 0.5 : 0.25;
}

export type KellySampleTier = "insufficient" | "limited" | "acceptable";

export function classifyKellySample(sampleSize: number): KellySampleTier {
  if (sampleSize < 30) return "insufficient";
  if (sampleSize < 100) return "limited";
  return "acceptable";
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
