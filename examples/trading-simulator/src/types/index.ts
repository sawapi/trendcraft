import type { NormalizedCandle } from "trendcraft";

export type { NormalizedCandle };

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type SimulatorPhase = "setup" | "running" | "finished";

export type PriceType = "nextOpen" | "high" | "low" | "close";

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  nextOpen: "翌日始値",
  high: "高値",
  low: "安値",
  close: "終値",
};

export interface Position {
  entryPrice: number;
  entryDate: number;
  entryIndex: number;
  shares: number;
}

export interface Trade {
  id: string;
  type: "BUY" | "SELL";
  date: number;
  price: number;
  shares: number;
  memo: string;
  priceType: PriceType;
  pnl?: number;
  pnlPercent?: number;
}

export interface SimulationConfig {
  startDate: number;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];
}

export interface SimulatorStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  profitFactor: number;
}

export interface YearHighLow {
  yearHigh: number;
  yearHighDate: number;
  yearLow: number;
  yearLowDate: number;
  currentPrice: number;
  fromHigh: number; // % from year high
  fromLow: number; // % from year low
}

export const AVAILABLE_INDICATORS = [
  { key: "sma5", label: "SMA 5" },
  { key: "sma25", label: "SMA 25" },
  { key: "sma75", label: "SMA 75" },
  { key: "ema12", label: "EMA 12" },
  { key: "ema26", label: "EMA 26" },
  { key: "bb", label: "Bollinger Bands" },
  { key: "rsi", label: "RSI 14" },
  { key: "macd", label: "MACD" },
  { key: "volume", label: "Volume" },
] as const;

export type IndicatorKey = (typeof AVAILABLE_INDICATORS)[number]["key"];
