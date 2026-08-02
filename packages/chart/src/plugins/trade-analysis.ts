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
 * const result = runBacktest(candles, entry, exit, { capital: 1_000_000 });
 * const handle = connectTradeAnalysis(chart, result.trades, candles);
 * ```
 */

import { withPaneClip } from "../core/draw-helper";
import { canvasFont } from "../core/font";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import { definePrimitive } from "../core/plugin-types";
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

export type TradeAnalysisOptions = {
  /**
   * Whether to draw the P&L percentage as a small label near the exit
   * dot. Default `true`. Backtest analysts read this number first when
   * scanning a result; without it the win / loss color of the exit dot
   * is the only signal.
   */
  showPnlLabel?: boolean;
  /**
   * Whether to label the right end of each MFE / MAE dashed line with
   * the absolute price level. Default `false` — useful when reviewing
   * single trades, but on a full backtest the labels stack and clutter.
   */
  showMfeMaeLabels?: boolean;
  /**
   * Custom price formatter for MFE / MAE labels. The default adapts the
   * decimal count to the price magnitude (≥1000 → 2 dp, ≥1 → 4 dp, <1 →
   * up to 8 dp), which works for equities, FX and crypto. Override this
   * if your instrument has a fixed tick size or a non-decimal display.
   */
  priceFormatter?: (price: number) => string;
};

type TradeAnalysisState = {
  trades: readonly TradeData[];
  candles: readonly CandleRef[];
  options: Required<TradeAnalysisOptions>;
};

const DEFAULT_OPTIONS: Required<TradeAnalysisOptions> = {
  showPnlLabel: true,
  showMfeMaeLabels: false,
  priceFormatter: defaultFormatPrice,
};

function resolveOptions(options: TradeAnalysisOptions = {}): Required<TradeAnalysisOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

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
  { ctx, pane, timeScale, priceScale, fontFamily }: PrimitiveRenderContext,
  state: TradeAnalysisState,
): void {
  const { trades, candles, options } = state;
  if (trades.length === 0 || candles.length === 0) return;

  withPaneClip(ctx, pane, () => {
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

      // Optional MFE / MAE end-of-line price labels.
      if (options.showMfeMaeLabels) {
        ctx.font = canvasFont(9, fontFamily);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${MFE_COLOR},0.85)`;
        ctx.fillText(options.priceFormatter(mfePrice), exitX + 4, mfeY);
        ctx.fillStyle = `rgba(${MAE_COLOR},0.85)`;
        ctx.fillText(options.priceFormatter(maePrice), exitX + 4, maeY);
      }

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

      // P&L label — placed above the exit dot for wins, below for losses
      // so it never visually crosses the trade line on its way out.
      if (options.showPnlLabel) {
        const pct = trade.returnPercent;
        const sign = pct >= 0 ? "+" : "";
        const label = `${sign}${pct.toFixed(2)}%`;
        ctx.font = canvasFont(10, fontFamily, "bold");
        ctx.textAlign = "left";
        if (isWin) {
          ctx.textBaseline = "bottom";
          ctx.fillStyle = `rgba(${TRADE_WIN_COLOR},0.95)`;
          ctx.fillText(label, exitX + 5, exitY - 4);
        } else {
          ctx.textBaseline = "top";
          ctx.fillStyle = `rgba(${TRADE_LOSS_COLOR},0.95)`;
          ctx.fillText(label, exitX + 5, exitY + 4);
        }
      }
    }
  });
}

/**
 * Adapt decimal count to the price's magnitude so the label is readable
 * across equities (e.g. `4500.12`), FX (e.g. `1.23456`) and low-priced
 * crypto (e.g. `0.00012345`) without callers having to specify precision.
 *
 * Hosts that need a fixed tick size or a non-decimal display can override
 * this via `TradeAnalysisOptions.priceFormatter`.
 */
function defaultFormatPrice(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  let decimals: number;
  if (abs >= 1000) decimals = 2;
  else if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 6;
  else decimals = 8;
  // Trim trailing zeros so "100.0000" reads as "100" but "1.2345" stays
  // intact. The trailing-dot guard handles values like "100." → "100".
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

// ---- Factory ----

export function createTradeAnalysis(
  trades: readonly TradeData[],
  candles: readonly CandleRef[],
  options: TradeAnalysisOptions = {},
): PrimitivePlugin<TradeAnalysisState> {
  return definePrimitive<TradeAnalysisState>({
    name: "tradeAnalysis",
    pane: "main",
    zOrder: "above",
    defaultState: { trades, candles, options: resolveOptions(options) },
    render: renderTradeAnalysis,
  });
}

// ---- Convenience connector ----

type TradeAnalysisHandle = {
  update(
    trades: readonly TradeData[],
    candles: readonly CandleRef[],
    options?: TradeAnalysisOptions,
  ): void;
  remove(): void;
};

export function connectTradeAnalysis(
  chart: ChartInstance,
  trades: readonly TradeData[],
  candles: readonly CandleRef[],
  options: TradeAnalysisOptions = {},
): TradeAnalysisHandle {
  // Track the last-applied options. Merge (not replace) so a partial
  // update — e.g. `update(data, candles, { showPnlLabel: false })` —
  // preserves previously-applied fields like `showMfeMaeLabels` or a
  // custom `priceFormatter` instead of silently reverting them to
  // defaults on the next render.
  let appliedOptions: TradeAnalysisOptions = { ...options };
  chart.registerPrimitive(createTradeAnalysis(trades, candles, appliedOptions));

  return {
    update(newTrades, newCandles, newOptions) {
      if (newOptions !== undefined) {
        appliedOptions = { ...appliedOptions, ...newOptions };
      }
      chart.registerPrimitive(createTradeAnalysis(newTrades, newCandles, appliedOptions));
    },
    remove() {
      chart.removePrimitive("tradeAnalysis");
    },
  };
}
