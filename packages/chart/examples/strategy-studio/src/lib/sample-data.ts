import data from "../../../simple-chart/data.json";

export type StudioCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const sampleCandles: StudioCandle[] = data;

/**
 * Synthetic multi-symbol dataset used by PortfolioPanel. We don't ship real
 * OHLCV for three tickers, so we transform `sampleCandles` into three
 * differently-shaped streams: a faster, more volatile name (×1.5 amplitude
 * around price 220), a steadier large-cap (×0.6 amplitude around 60), and
 * the original series as the baseline. Volumes are jittered so volume-based
 * indicators see different shapes per symbol.
 *
 * Times are shared across all three so `batchBacktest`'s merged equity
 * curve has a meaningful x-axis (a single trading calendar).
 */
function transformCandles(
  base: StudioCandle[],
  centerPrice: number,
  amplitude: number,
  volumeScale: number,
): StudioCandle[] {
  if (base.length === 0) return [];
  const baseCenter = (base[0].open + base[0].close) / 2;
  return base.map((c) => {
    const reframe = (px: number) => centerPrice + (px - baseCenter) * amplitude;
    return {
      time: c.time,
      open: reframe(c.open),
      high: reframe(c.high),
      low: reframe(c.low),
      close: reframe(c.close),
      volume: Math.max(1, Math.round(c.volume * volumeScale)),
    };
  });
}

export type SampleSymbol = {
  symbol: string;
  /** Display label shown in the panel; longer than the ticker. */
  label: string;
  candles: StudioCandle[];
};

// Synthetic ids only — these are NOT real ticker data. Real symbols would
// imply real OHLCV which Studio doesn't ship; descriptive synthetic names
// keep the demo honest and tell the user what each row is meant to show.
export const sampleSymbols: SampleSymbol[] = [
  { symbol: "BASE", label: "Baseline (sample data)", candles: sampleCandles },
  {
    symbol: "STEADY",
    label: "Steady (low volatility)",
    candles: transformCandles(sampleCandles, 60, 0.6, 1.4),
  },
  {
    symbol: "VOLAT",
    label: "Volatile (high amplitude)",
    candles: transformCandles(sampleCandles, 220, 1.5, 0.7),
  },
];
