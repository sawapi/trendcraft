import type { IndicatorManifest } from "../types";

export const VOLATILITY_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "atr",
    displayName: "Average True Range",
    category: "volatility",
    oneLiner: "Wilder's smoothed average of true range — the volatility workhorse.",
    whenToUse: [
      "Sizing stops as a multiple of ATR",
      "Position sizing scaled to current volatility",
      "Detecting volatility expansion/contraction regimes",
    ],
    signals: [
      "Rising ATR = volatility expanding (trend or breakout context)",
      "Falling ATR = volatility contracting (consolidation, breakout setup)",
    ],
    pitfalls: [
      "Direction-agnostic — never use alone for entries",
      "Absolute ATR varies by instrument; normalize as ATR%/price for cross-asset comparison",
    ],
    synergy: ["Bollinger Bands or Keltner for volatility-based bands", "Supertrend (ATR-based)"],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "14 Wilder standard",
    },
  },
  {
    kind: "bollingerBands",
    displayName: "Bollinger Bands",
    category: "volatility",
    oneLiner: "SMA with stddev-scaled upper/lower bands — volatility envelope.",
    whenToUse: [
      "Mean reversion within ranges (band touches as fade signals)",
      "Squeeze detection (low band width = breakout pending)",
      "Trend confirmation via band-walking (price hugs upper band in strong trend)",
    ],
    signals: [
      "Touch of lower band in range = oversold mean-revert signal",
      "Touch of upper band in range = overbought mean-revert signal",
      "Squeeze (narrow bands) = volatility compression preceding breakout",
      "Band-walk (sustained closes outside band) = trend continuation, not reversal",
    ],
    pitfalls: [
      "Band-walking traps fade traders during trends",
      "Default 20/2 is convention only — context matters",
      "Population vs sample stddev choice can shift signals subtly",
    ],
    synergy: [
      "ADX for distinguishing range (fade bands) from trend (band-walk)",
      "RSI divergence inside bands for stronger reversion signals",
    ],
    marketRegime: ["ranging", "volatile", "low-volatility"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "20 standard",
      stdDev: "2 standard; 1.5 for tighter, 2.5 for wider",
    },
  },
  {
    kind: "keltnerChannel",
    displayName: "Keltner Channel",
    category: "volatility",
    oneLiner: "EMA with ATR-scaled bands — Bollinger's smoother cousin.",
    whenToUse: [
      "Trend-following band breakout systems",
      "Filtering false Bollinger band touches via ATR-based bands",
      "TTM Squeeze setups (Bollinger inside Keltner = compression)",
    ],
    signals: [
      "Close above upper Keltner = trend breakout (not necessarily exhausted)",
      "Close back inside band after walk = trend cooling",
    ],
    pitfalls: [
      "Less sensitive than Bollinger to short volatility spikes",
      "Tuning multiplier requires asset/timeframe-specific calibration",
    ],
    synergy: ["Bollinger Bands for squeeze detection (Bollinger inside Keltner)"],
    marketRegime: ["trending", "volatile"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "20 default EMA period",
      multiplier: "2 default; 1.5 tighter, 3 wider",
    },
  },
  {
    kind: "donchianChannel",
    displayName: "Donchian Channel",
    category: "volatility",
    oneLiner: "Highest-high and lowest-low envelope over N bars.",
    whenToUse: [
      "Classical breakout systems (Turtle 20/55-bar breakouts)",
      "Range-extreme stop placement",
    ],
    signals: ["Close > upper Donchian = breakout buy", "Close < lower Donchian = breakdown sell"],
    pitfalls: [
      "Whipsaws on every false breakout in ranges",
      "Lookback is brittle — small period changes shift signals dramatically",
    ],
    marketRegime: ["trending", "volatile"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "20 short-term, 55 medium (Turtle) classics",
    },
  },
  {
    kind: "choppinessIndex",
    displayName: "Choppiness Index",
    category: "volatility",
    oneLiner: "Bounded measure (0-100) of how trending vs choppy a market is.",
    whenToUse: [
      "Pure regime filter — gate strategy choice by chop level",
      "Detecting consolidation periods preceding breakouts",
    ],
    signals: [
      "CI > 61.8 = choppy / range — favor mean-reversion",
      "CI < 38.2 = trending — favor trend-following",
    ],
    pitfalls: ["Lagging — confirms regime after the fact", "Direction-agnostic"],
    synergy: ["ADX for cross-confirmation of trend strength"],
    marketRegime: ["ranging", "trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "14 default",
    },
  },
  {
    kind: "atrStops",
    displayName: "ATR Stops",
    category: "volatility",
    oneLiner: "ATR-multiplied trailing stop levels above/below price.",
    whenToUse: ["Volatility-adjusted exits in trend systems", "Chandelier-style trailing stops"],
    signals: ["Price crossing ATR stop = exit / trend invalidation"],
    pitfalls: [
      "Multiplier tuning is asset-specific — same setting can be tight on stocks and loose on crypto",
    ],
    marketRegime: ["trending", "volatile"],
    timeframe: ["intraday", "swing", "position"],
  },
];
