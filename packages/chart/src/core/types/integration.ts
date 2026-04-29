/**
 * Integration / overlay types: multi-timeframe overlays, backtest results,
 * pattern signals, signal/trade markers, and internal rendering structs.
 */

import type { CandleData, DataPoint, TimeValue } from "./fundamental";
import type { PaneConfig } from "./pane";
import type { SeriesConfig, SeriesType } from "./series";

export type TimeframeOverlay = {
  /** Identifier for this timeframe overlay */
  id: string;
  /** Higher timeframe candle data */
  candles: CandleData[];
  /** Timeframe label (e.g., '1W', '1M') */
  timeframe: string;
  /** Candle body color (default: semi-transparent) */
  color?: string;
  /** Opacity (default: 0.15) */
  opacity?: number;
};

export type BacktestResultData = {
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  tradeCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: {
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    returnPercent: number;
    direction?: string;
    exitReason?: string;
  }[];
  drawdownPeriods: {
    startTime: number;
    troughTime: number;
    recoveryTime?: number;
    maxDepthPercent: number;
    peakEquity: number;
    troughEquity: number;
  }[];
};

export type ChartPatternSignal = {
  time: number;
  type: string;
  pattern: {
    startTime: number;
    endTime: number;
    keyPoints: { time: number; index: number; price: number; label: string }[];
    neckline?: { startPrice: number; endPrice: number; slope: number; currentPrice: number };
    target?: number;
    stopLoss?: number;
    height?: number;
  };
  confidence: number;
  confirmed: boolean;
};

export type SignalMarker = {
  time: TimeValue;
  type: "buy" | "sell";
  label?: string;
};

export type TradeMarker = {
  entryTime: TimeValue;
  entryPrice: number;
  exitTime: TimeValue;
  exitPrice: number;
  direction?: "long" | "short";
  returnPercent?: number;
  exitReason?: string;
};

/** Summary info for a series */
export type SeriesInfo = {
  id: string;
  paneId: string;
  type: SeriesType;
  label: string;
  visible: boolean;
};

/** Computed pane dimensions (from layout engine) */
export type PaneRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: PaneConfig;
};

/** Computed series rendering info */
export type ResolvedSeries = {
  id: string;
  paneId: string;
  type: SeriesType;
  config: SeriesConfig;
  data: DataPoint<unknown>[];
  /** Decomposed numeric channels for compound types */
  channels: Map<string, (number | null)[]>;
};
