/**
 * Equity View — places a backtest's `equityCurve` on the loaded candles.
 *
 * The curve is drawn as the engine computed it, never rebuilt from trades:
 * a rebuild compounds each trade's return over the whole account, which is
 * wrong once positions are sized or partly closed. Without a curve that can
 * be placed, nothing is drawn.
 */

import type { DataLayer } from "../core/data-layer";
import type { BacktestResultData } from "../core/types";

/** One drawn point of the equity curve */
export type EquityPoint = { idx: number; equity: number };

export type EquityView =
  | {
      ok: true;
      /**
       * Points on the loaded candles, in bar order (may be empty). A
       * non-finite curve value has no point, so the line bridges it.
       */
      points: EquityPoint[];
      /** Curve values up to the last loaded candle, from `equityCurve[0]` */
      reached: readonly number[];
    }
  | {
      ok: false;
      /** `missing`: no curve or no `firstBarTime`; `misaligned`: it does not fit the candles */
      reason: EquityViewProblem;
    };

export type EquityViewProblem = "missing" | "misaligned";

/** The warning for a result whose equity curve is not drawn */
export function equityWarning(reason: EquityViewProblem): string {
  return reason === "missing"
    ? "addBacktest: the result has no equityCurve with a firstBarTime, so no equity curve is drawn. Pass the runBacktest result as it is, or include equityCurve and firstBarTime."
    : "addBacktest: the result's equityCurve does not line up with the loaded candles, so no equity curve is drawn. Load the candles the backtest ran on.";
}

/** A known bar time: `0` is the engine's "no span information" value */
function knownTime(t: number | undefined): t is number {
  return t !== undefined && Number.isFinite(t) && t !== 0;
}

const cache = new WeakMap<
  BacktestResultData,
  { dataLayer: DataLayer; version: number; view: EquityView }
>();

/**
 * Place `result.equityCurve` on the loaded candles. The result is cached per
 * result object until the data layer changes.
 */
export function equityView(result: BacktestResultData, dataLayer: DataLayer): EquityView {
  const hit = cache.get(result);
  if (hit && hit.dataLayer === dataLayer && hit.version === dataLayer.version) return hit.view;
  const view = computeView(result, dataLayer);
  cache.set(result, { dataLayer, version: dataLayer.version, view });
  return view;
}

function computeView(result: BacktestResultData, dataLayer: DataLayer): EquityView {
  const curve = result.equityCurve;
  if (!curve || curve.length === 0 || !knownTime(result.firstBarTime)) {
    return { ok: false, reason: "missing" };
  }
  const count = dataLayer.candleCount;
  if (count === 0) return { ok: true, points: [], reached: [] };
  const firstLoaded = dataLayer.timeAt(0) as number;
  const lastLoaded = dataLayer.timeAt(count - 1) as number;
  const lastBarTime = knownTime(result.lastBarTime) ? result.lastBarTime : undefined;

  // Bar index of equityCurve[0]; negative when the loaded data starts later
  let anchor: number;
  if (result.firstBarTime > lastLoaded) {
    return { ok: true, points: [], reached: [] }; // the backtest starts after the data
  }
  if (result.firstBarTime >= firstLoaded) {
    anchor = dataLayer.indexAtTime(result.firstBarTime);
    if (dataLayer.timeAt(anchor) !== result.firstBarTime)
      return { ok: false, reason: "misaligned" };
  } else {
    // Older bars were dropped (maxCandles): place the curve by its last bar
    if (lastBarTime === undefined || lastBarTime < firstLoaded || lastBarTime > lastLoaded) {
      return { ok: false, reason: "misaligned" };
    }
    const end = dataLayer.indexAtTime(lastBarTime);
    if (dataLayer.timeAt(end) !== lastBarTime) return { ok: false, reason: "misaligned" };
    anchor = end - (curve.length - 1);
    // firstBarTime is before the data, so curve[0] must be too
    if (anchor >= 0) return { ok: false, reason: "misaligned" };
  }

  if (lastBarTime !== undefined && lastBarTime <= lastLoaded) {
    // The run's last bar is loaded: it must carry the curve's last value
    const end = dataLayer.indexAtTime(lastBarTime);
    if (dataLayer.timeAt(end) !== lastBarTime || end !== anchor + curve.length - 1) {
      return { ok: false, reason: "misaligned" };
    }
  } else if (count - anchor > curve.length) {
    // More candles from the anchor on than the curve has values
    return { ok: false, reason: "misaligned" };
  }

  const reachedLength = Math.min(curve.length, count - anchor);
  const points: EquityPoint[] = [];
  for (let i = Math.max(0, -anchor); i < reachedLength; i++) {
    const equity = curve[i];
    if (Number.isFinite(equity)) points.push({ idx: anchor + i, equity });
  }
  return { ok: true, points, reached: curve.slice(0, reachedLength) };
}

/**
 * Whether the loaded candles stop before the end of the run, as in a replay.
 * Uses `lastBarTime`; when that is unknown, the curve's length and whether
 * any trade exits after the last loaded candle.
 */
export function isPartialRun(
  result: BacktestResultData,
  view: EquityView,
  dataLayer: DataLayer,
): boolean {
  const count = dataLayer.candleCount;
  if (count === 0) return true;
  if (knownTime(result.lastBarTime)) {
    return result.lastBarTime > (dataLayer.timeAt(count - 1) as number);
  }
  const lastLoaded = dataLayer.timeAt(count - 1) as number;
  if (result.trades.some((t) => t.exitTime > lastLoaded)) return true;
  return (
    view.ok && result.equityCurve !== undefined && view.reached.length < result.equityCurve.length
  );
}

/** Deepest peak-to-trough decline of a curve, in percent of the peak */
export function maxDrawdownPercent(curve: readonly number[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const value of curve) {
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
    else if (peak > 0) worst = Math.max(worst, ((peak - value) / peak) * 100);
  }
  return worst;
}
