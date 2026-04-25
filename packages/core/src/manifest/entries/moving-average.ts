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
      "Crossover signals print well after the move began; the lag is instrument- and regime-dependent",
      "Equal weighting means stale prices distort the signal as much as recent prices",
      "Whipsaws repeatedly when 50/200 weave around each other in ranging markets",
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
      "Initial values are sensitive to seed method — trendcraft's impl uses SMA-of-period seed (TA-Lib style)",
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
      "Impl detail: trendcraft seeds the recursion at index `period` with the input price at `period-1` (TA-Lib compatible). First non-null output is at index `period`, not `period-1`. Variants that SMA-seed differ slightly in early bars",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "10 default ER lookback (Perry Kaufman recommendation)",
      fastPeriod: "2 default — fastest EMA constant, hardcoded in TA-Lib",
      slowPeriod: "30 default — slowest EMA constant, hardcoded in TA-Lib",
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
      "Long warmup: 6×(period-1) bars before first non-null value (e.g. period=5 → first value at index 24)",
      "Higher vFactor = faster signals but less smooth; lower = smoother but more lag",
      "Six cascaded EMAs amplify any seed-method differences across implementations",
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
      "VWMA above SMA = within the window, higher-volume bars closed at relatively higher prices (bullish skew)",
      "VWMA below SMA = within the window, higher-volume bars closed at relatively lower prices (bearish skew)",
      "Larger spread between VWMA and SMA = stronger volume-confirmed trend",
    ],
    pitfalls: [
      "Useless on instruments with unreliable volume (some FX, OTC)",
      "Sensitive to volume spikes from news events — a single huge bar can drag VWMA",
      "trendcraft impl returns null when all volumes in the window are 0",
    ],
    synergy: [
      "OBV for cumulative volume flow context",
      "VWAP for intraday institutional cost reference",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
  },
];
