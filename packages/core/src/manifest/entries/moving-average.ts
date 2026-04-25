import type { IndicatorManifest } from "../types";

export const MOVING_AVERAGE_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "sma",
    displayName: "Simple Moving Average",
    category: "moving-average",
    oneLiner: "Arithmetic mean of price over N periods — the baseline trend filter.",
    whenToUse: [
      "Long-term trend identification (50/200 SMA crossovers)",
      "Smoothing noisy series for visual reference",
      "Defining dynamic support/resistance on higher timeframes",
    ],
    signals: [
      "Price above rising SMA = uptrend bias",
      "Golden cross (short SMA crosses above long SMA) = bullish trend confirmation",
      "Dead cross (short SMA crosses below long SMA) = bearish trend confirmation",
    ],
    pitfalls: [
      "Lags strongly — turning points are visible only after the move",
      "Equal weighting means stale prices distort the signal as much as recent prices",
      "Whipsaws often in ranging markets",
    ],
    synergy: [
      "ATR for volatility-adjusted stop placement around the SMA",
      "RSI for momentum confirmation of trend direction",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "20 for short-term, 50 for medium, 200 for primary trend",
    },
  },
  {
    kind: "ema",
    displayName: "Exponential Moving Average",
    category: "moving-average",
    oneLiner: "Exponentially weighted MA — more responsive than SMA, emphasizes recent prices.",
    whenToUse: [
      "Trend following where SMA's lag is too costly",
      "Short-to-medium term entries (9/21/50 EMA stacks)",
      "MACD-style crossover systems",
    ],
    signals: [
      "Price above rising EMA = bullish bias",
      "EMA stack (e.g. 9 > 21 > 50) = strong aligned trend",
      "EMA cross of two periods = momentum shift",
    ],
    pitfalls: [
      "Still lags on sharp reversals",
      "More whipsaws than SMA in choppy conditions",
      "Initial values are sensitive to seed method (SMA seed vs first-value seed)",
    ],
    synergy: [
      "MACD for momentum confirmation (it is built from EMAs)",
      "VWAP for intraday trend bias relative to institutional cost",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "9 fast, 21 medium, 50 slow are common day-trader stacks",
    },
  },
  {
    kind: "hma",
    displayName: "Hull Moving Average",
    category: "moving-average",
    oneLiner: "WMA-based MA designed to reduce lag while remaining smooth.",
    whenToUse: [
      "Trend following where EMA still feels too laggy",
      "Short-term swing entries on directional moves",
      "Inputs to higher-frequency systems requiring smooth-but-fast signals",
    ],
    signals: [
      "Color/slope change of HMA = early trend reversal cue",
      "Price above rising HMA = bullish bias",
    ],
    pitfalls: [
      "Reduced lag comes with more false reversals in choppy markets",
      "Very short periods become noisy quickly",
    ],
    synergy: ["ADX/DMI to filter HMA signals to trending regimes only"],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "9-21 typical for swing, smaller for intraday",
    },
  },
  {
    kind: "kama",
    displayName: "Kaufman Adaptive Moving Average",
    category: "moving-average",
    oneLiner: "Adaptive MA that speeds up in trends and slows down in chop.",
    whenToUse: [
      "Mixed regime markets where a fixed-period MA over- or under-reacts",
      "Trend following with built-in noise filtering",
    ],
    signals: [
      "Price above rising KAMA = bullish bias with regime-aware smoothing",
      "Flat KAMA = market is in noise mode — avoid trend trades",
    ],
    pitfalls: [
      "Adaptive nature can mask genuine trend changes if the efficiency ratio collapses",
      "Less intuitive to tune than fixed-period MAs",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "10 default; fastPeriod=2 and slowPeriod=30 are standard",
    },
  },
  {
    kind: "t3",
    displayName: "Tillson T3",
    category: "moving-average",
    oneLiner: "Six-cascade EMA delivering ultra-smooth output with minimal lag.",
    whenToUse: [
      "Visualizing clean trend without the jitter of a single EMA",
      "Slow line in custom crossover systems",
    ],
    signals: [
      "Slope change after a sustained trend = potential exhaustion",
      "Price holding above a rising T3 = strong trend integrity",
    ],
    pitfalls: [
      "Long warmup (6×(period-1) bars before first value)",
      "vFactor tuning is non-obvious",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "5 default; vFactor 0.7 is the standard smoothness control",
    },
  },
  {
    kind: "vwma",
    displayName: "Volume-Weighted Moving Average",
    category: "moving-average",
    oneLiner: "SMA weighted by traded volume — emphasizes high-conviction prices.",
    whenToUse: [
      "Confirming that a trend is supported by volume",
      "Detecting divergence between price MA and volume-weighted MA",
    ],
    signals: [
      "VWMA above SMA = volume is concentrating on up-bars (bullish)",
      "VWMA below SMA = volume is concentrating on down-bars (bearish)",
    ],
    pitfalls: [
      "Useless on instruments with unreliable volume (some FX)",
      "Sensitive to volume spikes from news events",
    ],
    synergy: [
      "OBV for cumulative volume flow context",
      "VWAP for intraday institutional cost reference",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
  },
];
