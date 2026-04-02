/**
 * Trade Analysis Overlay Plugin — Visualizes MFE/MAE on backtest trades.
 *
 * For each trade, draws:
 * - MFE line: highest favorable price reached during the trade (green dashed)
 * - MAE line: highest adverse price reached during the trade (red dashed)
 * - Entry/exit markers connected by the actual trade line
 *
 * @example
 * ```typescript
 * import { createChart, connectTradeAnalysis } from '@trendcraft/chart';
 * import { runBacktest } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const result = runBacktest(candles, entry, exit);
 * const handle = connectTradeAnalysis(chart, result.trades, candles);
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Types (duck-typed) ----

type TradeData = {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  returnPercent: number;
  mfe?: number;
  mae?: number;
  direction?: "long" | "short";
};

type CandleRef = {
  time: number;
  high: number;
  low: number;
};

type TradeAnalysisState = {
  trades: readonly TradeData[];
  candles: readonly CandleRef[];
};

// ---- Colors ----

const MFE_COLOR = "38,166,154";
const MAE_COLOR = "239,83,80";
const TRADE_WIN_COLOR = "38,166,154";
const TRADE_LOSS_COLOR = "239,83,80";

// ---- Helpers ----

function findIndex(candles: readonly CandleRef[], time: number): number {
  // Binary search
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time === time) return mid;
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return lo;
}

function computeMfeMaePrice(
  candles: readonly CandleRef[],
  entryIdx: number,
  exitIdx: number,
  entryPrice: number,
  direction: "long" | "short",
): { mfePrice: number; maePrice: number } {
  let mfePrice = entryPrice;
  let maePrice = entryPrice;

  for (let i = entryIdx; i <= exitIdx && i < candles.length; i++) {
    if (direction === "long") {
      if (candles[i].high > mfePrice) mfePrice = candles[i].high;
      if (candles[i].low < maePrice) maePrice = candles[i].low;
    } else {
      if (candles[i].low < mfePrice) mfePrice = candles[i].low;
      if (candles[i].high > maePrice) maePrice = candles[i].high;
    }
  }

  return { mfePrice, maePrice };
}

// ---- Render ----

function renderTradeAnalysis(
  { ctx, pane, timeScale, priceScale }: PrimitiveRenderContext,
  state: TradeAnalysisState,
): void {
  const { trades, candles } = state;
  if (trades.length === 0 || candles.length === 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  for (const trade of trades) {
    const entryIdx = findIndex(candles, trade.entryTime);
    const exitIdx = findIndex(candles, trade.exitTime);
    if (entryIdx >= candles.length || exitIdx >= candles.length) continue;

    const direction = trade.direction ?? (trade.returnPercent >= 0 ? "long" : "short");
    const entryX = timeScale.indexToX(entryIdx);
    const exitX = timeScale.indexToX(exitIdx);
    const entryY = priceScale.priceToY(trade.entryPrice);
    const exitY = priceScale.priceToY(trade.exitPrice);

    // Compute MFE/MAE price levels from candles
    const { mfePrice, maePrice } = computeMfeMaePrice(
      candles,
      entryIdx,
      exitIdx,
      trade.entryPrice,
      direction,
    );

    const mfeY = priceScale.priceToY(mfePrice);
    const maeY = priceScale.priceToY(maePrice);

    // MFE dashed line
    ctx.save();
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = `rgba(${MFE_COLOR},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(entryX, mfeY);
    ctx.lineTo(exitX, mfeY);
    ctx.stroke();
    ctx.restore();

    // MAE dashed line
    ctx.save();
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = `rgba(${MAE_COLOR},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(entryX, maeY);
    ctx.lineTo(exitX, maeY);
    ctx.stroke();
    ctx.restore();

    // Shaded area between MFE and MAE
    const topY = Math.min(mfeY, maeY);
    const bottomY = Math.max(mfeY, maeY);
    ctx.fillStyle = "rgba(120,123,134,0.03)";
    ctx.fillRect(entryX, topY, exitX - entryX, bottomY - topY);

    // Trade line (entry → exit)
    const isWin = trade.returnPercent >= 0;
    ctx.strokeStyle = `rgba(${isWin ? TRADE_WIN_COLOR : TRADE_LOSS_COLOR},0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);
    ctx.lineTo(exitX, exitY);
    ctx.stroke();

    // Entry dot
    ctx.fillStyle = "rgba(33,150,243,0.8)";
    ctx.beginPath();
    ctx.arc(entryX, entryY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Exit dot
    ctx.fillStyle = `rgba(${isWin ? TRADE_WIN_COLOR : TRADE_LOSS_COLOR},0.8)`;
    ctx.beginPath();
    ctx.arc(exitX, exitY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---- Factory ----

export function createTradeAnalysis(
  trades: readonly TradeData[],
  candles: readonly CandleRef[],
): PrimitivePlugin<TradeAnalysisState> {
  return definePrimitive<TradeAnalysisState>({
    name: "tradeAnalysis",
    pane: "main",
    zOrder: "above",
    defaultState: { trades, candles },
    render: renderTradeAnalysis,
  });
}

// ---- Convenience connector ----

type TradeAnalysisHandle = {
  update(trades: readonly TradeData[], candles: readonly CandleRef[]): void;
  remove(): void;
};

export function connectTradeAnalysis(
  chart: ChartInstance,
  trades: readonly TradeData[],
  candles: readonly CandleRef[],
): TradeAnalysisHandle {
  chart.registerPrimitive(createTradeAnalysis(trades, candles));

  return {
    update(newTrades, newCandles) {
      chart.registerPrimitive(createTradeAnalysis(newTrades, newCandles));
    },
    remove() {
      chart.removePrimitive("tradeAnalysis");
    },
  };
}
