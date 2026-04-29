/**
 * Fundamental data types
 */

/** Epoch milliseconds — matches trendcraft convention */
export type TimeValue = number;

/** Generic data point (compatible with trendcraft Series<T>) */
export type DataPoint<T = number | null> = {
  time: TimeValue;
  value: T;
};

/** OHLCV candle data */
export type CandleData = {
  time: TimeValue;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
