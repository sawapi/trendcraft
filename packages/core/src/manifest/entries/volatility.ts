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
      "Switching the period frequently introduces inconsistency in stop placement and position sizing — pick a value and stick with it",
      "Common stop multiplier ranges 1.5-3 — too tight = stopped out by noise, too loose = giving up too much per trade",
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
      "trendcraft uses population stddev (/N), TA-Lib compatible — implementations using sample stddev (/N-1) yield slightly wider bands",
      "%B and Bandwidth are useful derived studies but secondary to the core bands in many workflows",
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
    oneLiner:
      "EMA centerline with ATR-scaled bands; smoother and less reactive than Bollinger Bands.",
    whenToUse: [
      "Trend-following band breakout systems",
      "Filtering false Bollinger band touches via ATR-based bands",
      "TTM Squeeze setups (Bollinger inside Keltner = compression preceding expansion)",
    ],
    signals: [
      "Close above upper Keltner = trend breakout (not necessarily exhausted)",
      "Close back inside band after walk = trend cooling",
      "Bollinger Bands fully enclosed within Keltner = squeeze (low-vol regime, expansion likely)",
    ],
    pitfalls: [
      "Less sensitive than Bollinger to short volatility spikes",
      "Tuning multiplier requires asset/timeframe-specific calibration — multiplier has the largest effect on channel width",
    ],
    synergy: [
      "Bollinger Bands for TTM Squeeze detection (BB inside KC = compression)",
      "ATR family — both rely on the same underlying volatility measure",
    ],
    marketRegime: ["trending", "volatile"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      emaPeriod: "20 default EMA period for centerline (Linda Bradford Raschke modernization)",
      atrPeriod:
        "10 in trendcraft impl. Other common defaults: 14, 20 — platform-dependent. Separate from emaPeriod here",
      multiplier: "2 default; 1.5 tighter, 3 wider — multiplier dominates channel width",
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
    signals: [
      "Close > upper Donchian = breakout buy",
      "Close < lower Donchian = breakdown sell",
      "Turtle System 1: enter on 20-day high/low, exit on 10-day opposite. System 2: enter on 55-day high/low, exit on 20-day opposite",
    ],
    pitfalls: [
      "Whipsaws on every false breakout in ranges",
      "Lookback is brittle — small period changes shift signals dramatically",
      "Modern Turtle-style win rate is often 30-40% — many small whipsaw losses are the cost of catching the rare large trend",
    ],
    marketRegime: ["trending", "volatile"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "20 = Turtle System 1 (short-term breakout), 55 = System 2 (long-term)",
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
      "CI > 61.8 = choppy / range — favor mean-reversion (Fibonacci 0.618)",
      "CI < 38.2 = trending — favor trend-following (Fibonacci 0.382)",
      "38.2-61.8 transitional zone — wait for clearer regime before committing",
    ],
    pitfalls: [
      "Lagging — confirms regime after the fact",
      "Direction-agnostic",
      "Fibonacci thresholds are zones of transition, not hard boundaries",
    ],
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
    oneLiner: "ATR-multiplied stop-loss and take-profit levels for both long and short positions.",
    whenToUse: [
      "Volatility-adjusted exits in trend systems",
      "Chandelier-style trailing stops",
      "Position sizing: shares = risk_amount / stopDistance (returns stopDistance directly)",
      "Consistent risk/reward sizing across instruments with different volatility",
    ],
    signals: [
      "Price crossing longStopLevel = exit long / trend invalidation",
      "Price reaching longTakeProfitLevel = scale out / take profit",
    ],
    pitfalls: [
      "Multiplier tuning is asset-specific — same setting can be tight on stocks and loose on crypto",
      "Take-profit at 3×ATR with 2×ATR stop assumes 1:1.5 RR — verify the assumption holds for your edge",
    ],
    marketRegime: ["trending", "volatile"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "14 default ATR period",
      stopMultiplier: "2.0 default — common range 1.5-3.0",
      takeProfitMultiplier: "3.0 default — produces 1.5x stop distance for 1:1.5 RR",
    },
  },
];
