/**
 * Scanner type definitions
 */

export type ScannerOptions = {
  /** Minimum ATR% to include (default: 1.0) */
  minAtrPercent?: number;
  /** RSI range filter [min, max] (default: no filter) */
  rsiRange?: [number, number];
  /** Minimum volume ratio vs 20-day average (default: 0.5) */
  minVolumeRatio?: number;
  /** Number of top candidates to return (default: 10) */
  top?: number;
  /** Lookback days for historical data (default: 60) */
  lookbackDays?: number;
  /** Maximum concurrent API requests (default: 5) */
  concurrency?: number;
};

export type ScanCandidate = {
  symbol: string;
  price: number;
  atrPercent: number;
  rsi14: number | null;
  volumeRatio: number;
  /** Composite ranking score (0-100) */
  score: number;
};

export type ScanResult = {
  timestamp: number;
  universe: string;
  totalSymbols: number;
  scannedSymbols: number;
  skipped: Array<{ symbol: string; reason: string }>;
  candidates: ScanCandidate[];
  elapsedMs: number;
};
