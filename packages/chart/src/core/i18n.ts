/**
 * i18n — Locale strings for the chart.
 * All user-facing text is centralized here for easy localization.
 */

export type ChartLocale = {
  // OHLCV labels (short, used inline in the OHLCV overlay)
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  // Full label for the volume pane title (longer form)
  volumePaneTitle: string;

  // Month abbreviations (12)
  months: readonly string[];

  // Backtest summary
  return_: string;
  win: string;
  sharpe: string;
  maxDD: string;
  pf: string;
  trades: string;

  // Accessibility
  chartDescription: string;
  keyboardShortcuts: string;
  dataPoints: string;
  indicator: string;
  indicators: string;
  toggleVisibility: (label: string) => string;

  // Drawing
  defaultLabel: string;
};

export const DEFAULT_LOCALE: ChartLocale = {
  open: "O",
  high: "H",
  low: "L",
  close: "C",
  volume: "V",
  volumePaneTitle: "Volume",

  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],

  return_: "Return",
  win: "Win",
  sharpe: "Sharpe",
  maxDD: "MaxDD",
  pf: "PF",
  trades: "Trades",

  chartDescription: "interactive financial chart",
  keyboardShortcuts:
    "Keyboard: Arrow left/right to pan, Up/Down or +/- to zoom, Home/End to jump, F to fit all data",
  dataPoints: "data points",
  indicator: "indicator",
  indicators: "indicators",
  toggleVisibility: (label: string) => `Toggle ${label} visibility`,

  defaultLabel: "Label",
};

/** Merge a partial locale with defaults */
export function mergeLocale(partial?: Partial<ChartLocale>): ChartLocale {
  if (!partial) return DEFAULT_LOCALE;
  return { ...DEFAULT_LOCALE, ...partial };
}
