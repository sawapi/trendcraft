import type { StudioCandle } from "../sample-data";

export type Timeframe = "1Min" | "5Min" | "15Min" | "1Hour" | "1Day";

export type DataSource =
  | { kind: "synthetic" }
  | { kind: "alpaca"; symbol: string; timeframe: Timeframe };

export type LoadResult = {
  candles: StudioCandle[];
  source: DataSource;
};

export const TIMEFRAME_ORDER: Timeframe[] = ["1Min", "5Min", "15Min", "1Hour", "1Day"];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1Min": "1m",
  "5Min": "5m",
  "15Min": "15m",
  "1Hour": "1H",
  "1Day": "1D",
};

/**
 * Lookback window per timeframe, sized to land near ~2,000-2,500 bars so that
 * indicators with long warm-up (SMA(200), Ichimoku, etc.) have enough history
 * regardless of which timeframe the user picks.
 */
export const TIMEFRAME_LOOKBACK_DAYS: Record<Timeframe, number> = {
  "1Min": 5,
  "5Min": 30,
  "15Min": 90,
  "1Hour": 365,
  "1Day": 3650,
};

export function dataSourceKey(source: DataSource): string {
  if (source.kind === "synthetic") return "synthetic";
  return `alpaca:${source.symbol}:${source.timeframe}`;
}
