import type { IndicatorManifest } from "../types";

export const MOMENTUM_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "rsi",
    displayName: "Relative Strength Index",
    category: "momentum",
    oneLiner: "Bounded oscillator (0-100) measuring magnitude of recent gains vs losses.",
    whenToUse: [
      "Mean-reversion entries in ranging markets",
      "Spotting bullish/bearish divergence against price",
      "Confirming momentum exhaustion at trend extremes",
    ],
    signals: [
      "RSI < 30 = oversold (potential bounce in range)",
      "RSI > 70 = overbought (potential pullback in range)",
      "Bullish divergence (price lower low, RSI higher low) = reversal cue",
      "Failure swings (RSI fails to retake 70/30) = trend weakening",
    ],
    pitfalls: [
      "Strong trends keep RSI overbought/oversold for long stretches — naive 30/70 entries get crushed",
      "Lookback of 14 is convention, not law — shorter periods amplify noise",
      "Absolute level meaningless without trend context",
    ],
    synergy: [
      "ADX or DMI to gate RSI signals to ranging regimes (low ADX) only",
      "MACD for momentum direction confirmation",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "14 standard; 9 for shorter cycles, 21 for smoother long-term",
    },
  },
  {
    kind: "macd",
    displayName: "MACD",
    category: "momentum",
    oneLiner: "Difference of two EMAs with a signal line — momentum and trend in one.",
    whenToUse: [
      "Trend-following entries via signal line crosses",
      "Divergence detection on swing timeframes",
      "Histogram momentum analysis (rising/falling pace)",
    ],
    signals: [
      "MACD crosses above signal = bullish momentum shift",
      "MACD crosses below signal = bearish momentum shift",
      "Histogram peaks/troughs = momentum acceleration/deceleration",
      "Zero-line crosses = longer-term trend direction change",
    ],
    pitfalls: [
      "Signal-line crosses are laggy in fast markets",
      "Whipsaws hard in low-volatility chop",
      "Default 12/26/9 is daily-bar convention; smaller bars need adjustment",
    ],
    synergy: [
      "200-period MA as a higher-timeframe trend filter",
      "RSI for divergence cross-confirmation",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      fastPeriod: "12 standard",
      slowPeriod: "26 standard",
      signalPeriod: "9 standard",
    },
  },
  {
    kind: "stochastics",
    displayName: "Stochastic Oscillator",
    category: "momentum",
    oneLiner: "Position of close within recent high-low range, smoothed K and D lines (0-100).",
    whenToUse: ["Range-bound mean reversion", "Confirming entries with K/D cross in extreme zones"],
    signals: [
      "K crosses above D in <20 zone = oversold reversal cue",
      "K crosses below D in >80 zone = overbought reversal cue",
      "Hidden divergence = trend continuation",
    ],
    pitfalls: [
      "Stays pinned in extremes during strong trends — fade signals fail",
      "Very sensitive to lookback choice",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      kPeriod: "14 standard for swing",
      dPeriod: "3 standard smoothing",
    },
  },
  {
    kind: "dmi",
    displayName: "DMI / ADX",
    category: "momentum",
    oneLiner: "+DI, -DI, and ADX for trend direction and strength.",
    whenToUse: [
      "Filtering trend vs range regimes (ADX threshold)",
      "Confirming trend direction via +DI vs -DI dominance",
      "Sizing trend-follower aggressiveness by ADX magnitude",
    ],
    signals: [
      "ADX > 25 = strong trend (direction from +DI/-DI)",
      "ADX < 20 = no trend (favor range strategies)",
      "+DI crosses above -DI with rising ADX = trend ignition",
    ],
    pitfalls: [
      "ADX is direction-agnostic — never use alone for entries",
      "ADX rises during strong moves in either direction; can be late at the end of a trend",
    ],
    synergy: [
      "RSI gated by ADX < 20 for clean range fades",
      "MACD gated by ADX > 25 for clean trend follows",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "14 is the Wilder standard",
    },
  },
  {
    kind: "cci",
    displayName: "Commodity Channel Index",
    category: "momentum",
    oneLiner: "Distance of price from its mean, scaled by mean deviation.",
    whenToUse: ["Detecting cyclical extremes", "Catching breakout momentum past ±100"],
    signals: [
      "CCI > +100 = strong bullish momentum",
      "CCI < -100 = strong bearish momentum",
      "Reverse-cross of ±100 = trend exhaustion",
    ],
    pitfalls: [
      "Unbounded — extreme values do not have a fixed ceiling",
      "Whipsaws in low-volatility regimes",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
  },
  {
    kind: "roc",
    displayName: "Rate of Change",
    category: "momentum",
    oneLiner: "Percent change of price over N bars — pure momentum.",
    whenToUse: ["Cross-asset momentum ranking", "Filtering trades by momentum strength threshold"],
    signals: [
      "ROC > 0 with rising slope = accelerating uptrend",
      "ROC zero-line cross = trend direction change",
    ],
    pitfalls: [
      "No bounded interpretation — needs comparable peers or historical context",
      "Sensitive to gaps and outlier bars",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
  },
  {
    kind: "williamsR",
    displayName: "Williams %R",
    category: "momentum",
    oneLiner: "Inverted stochastic-style oscillator (-100 to 0).",
    whenToUse: [
      "Range mean reversion (alternative to stochastics)",
      "Short-cycle overbought/oversold detection",
    ],
    signals: ["%R < -80 = oversold", "%R > -20 = overbought"],
    pitfalls: ["Same as stochastics — gets stuck in extremes during trends"],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing"],
  },
  {
    kind: "connorsRsi",
    displayName: "Connors RSI",
    category: "momentum",
    oneLiner: "Composite of short RSI, streak RSI, and ROC percentile (0-100).",
    whenToUse: [
      "Short-term mean reversion on equities",
      "Pullback timing within established trends",
    ],
    signals: ["CRSI < 5 in uptrend = strong pullback buy signal", "CRSI > 95 = exhaustion"],
    pitfalls: [
      "Designed for daily equities; less reliable on FX or 24h crypto",
      "Streak component is sensitive to gap-driven false streaks",
    ],
    synergy: ["200-day MA as trend filter to avoid catching falling knives"],
    marketRegime: ["ranging", "trending"],
    timeframe: ["swing"],
    paramHints: {
      rsiPeriod: "3 default — intentionally short",
      streakPeriod: "2 default",
      rocPeriod: "100 default for percentile lookback",
    },
  },
];
