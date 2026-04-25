import type { IndicatorManifest } from "../types";

export const TREND_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "supertrend",
    displayName: "Supertrend",
    category: "trend",
    oneLiner: "ATR-bounded line that flips bullish/bearish as price crosses.",
    whenToUse: [
      "Visual trend direction with built-in stop level",
      "Simple flip-based trend systems",
      "Stop placement on trend-follow entries",
    ],
    signals: [
      "Supertrend flips green = bullish state begins",
      "Supertrend flips red = bearish state begins",
      "Price below red line = downtrend; above green = uptrend",
    ],
    pitfalls: [
      "Whipsaws hard in choppy ranges (this is its main weakness)",
      "Late entries: the flip requires a close beyond the band — by which point price has already moved an ATR-chunk",
      "Smaller multiplier flips more often (more whipsaws); larger multiplier holds longer but reacts later",
    ],
    synergy: [
      "ADX > 20 or Choppiness Index regime filter to disable Supertrend entries in chop",
      "VWMA / volume confirmation on flip signals",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period:
        "10 default ATR period. Heuristic examples (not canonical): intraday 7/3; swing 14/2 or 20/3",
      multiplier: "3 default. 2 = tighter / more flips, 4 = wider / fewer flips",
    },
  },
  {
    kind: "parabolicSar",
    displayName: "Parabolic SAR",
    category: "trend",
    oneLiner: "Stop-and-reverse dots that accelerate as the trend extends.",
    whenToUse: ["Trailing stops on trend trades", "Visual trend direction at a glance"],
    signals: [
      "Dots flip from below to above price = trend reversal to down",
      "Dots flip from above to below price = trend reversal to up",
    ],
    pitfalls: [
      "Reverses prematurely in ranges or pullbacks — the indicator only works well in clearly trending markets",
      "Lagging indicator: follows price action, useful only when a strong trend is established",
      "Too tight an acceleration factor causes premature reversals; too loose lets stops drift far from price",
    ],
    synergy: ["ADX or Choppiness regime filter to disable PSAR entries during chop"],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      step: "0.02 default acceleration step (Wilder's classic)",
      max: "0.20 default acceleration cap (Wilder's classic)",
    },
  },
  {
    kind: "ichimoku",
    displayName: "Ichimoku Kinko Hyo",
    category: "trend",
    oneLiner: "Multi-component trend system: Tenkan, Kijun, Senkou A/B (cloud), Chikou.",
    whenToUse: [
      "All-in-one trend / momentum / support-resistance system",
      "Multi-timeframe trend bias on swing/position trades",
    ],
    signals: [
      "Price above cloud = bullish bias",
      "Price below cloud = bearish bias",
      "Price inside cloud = no trend / chop",
      "Tenkan/Kijun cross above cloud = strong bullish signal",
      "Cloud color change = future trend bias shift",
    ],
    pitfalls: [
      "Many components — risk of overfitting interpretations",
      "Lagging on fast reversals",
      "Originally designed for daily Japanese equities; default 9/26/52 is widely cited as reflecting Japan's historical 6-day trading week — tuning needed elsewhere",
      "Cross signals inside the cloud are weak/neutral; treat thin clouds as weak S/R",
      "Ignoring the Chikou span often leads to false-confidence entries against the longer-term picture",
    ],
    synergy: [
      "Use Kijun-sen as a dynamic trailing stop rather than Tenkan (less noisy)",
      "Wait for retest entries on Kumo breakouts to reduce false signals",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      tenkanPeriod: "9 default (short-term)",
      kijunPeriod: "26 default (medium-term, also used as displacement)",
      senkouBPeriod: "52 default (long-term, drives second cloud boundary)",
      displacement: "26 default — Kumo and Chikou shift",
    },
  },
  {
    kind: "linearRegression",
    displayName: "Linear Regression",
    category: "trend",
    oneLiner:
      "Least-squares regression line over a rolling window — emits regression value, slope, intercept, and R-squared.",
    whenToUse: [
      "Quantifying trend direction (slope sign) and strength (R²) statistically",
      "Replacing visual trend lines with an objective best-fit line",
      "Building block for regression-channel strategies and statistical arbitrage",
    ],
    signals: [
      "slope > 0 = uptrend; slope < 0 = downtrend",
      "Steeper slope = stronger trend (compare relative slope, not absolute)",
      "R² close to 1 = trend is statistically clean / linear",
      "R² close to 0 = chop / noisy price action",
      "Some practitioners use ~0.7 as a heuristic for a relatively clean linear trend — not a standard statistical cutoff",
    ],
    pitfalls: [
      "R² measures goodness-of-fit to a straight line over the window — correlates with trend 'cleanliness', not economic/trading strength",
      "R² measures linearity — a curved (parabolic) trend can have low R² yet strong directional bias",
      "Slope is in price-units-per-bar, not directly comparable across instruments without normalization",
      "Linear regression assumes a linear relationship — useless on highly cyclical or mean-reverting series",
      "Sensitive to outliers (least-squares minimizes squared error, amplifying outlier influence)",
    ],
    synergy: ["ADX or Choppiness Index for cross-confirmation of trend strength"],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "14 default rolling window",
    },
  },
];
