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
      "In bullish RSI ranges (~40-80) pullbacks tend to hold near 40-50 instead of 30 — useful for buying dips in uptrends",
      "Bullish divergence (price lower low, RSI higher low) = reversal cue",
      "Failure swings (RSI fails to retake 70/30 after a pullback) = trend weakening",
    ],
    pitfalls: [
      "Strong trends keep RSI overbought/oversold for long stretches — naive 30/70 entries get crushed",
      "Divergences are misleading in strong trends; bearish divergence in a strong uptrend can repeat many times before a top",
      "Lookback of 14 is convention, not law — shorter periods amplify noise",
      "Absolute level meaningless without trend context",
      "Wilder himself recommended RSI as confirmation, never a standalone system",
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
      "Signal-line crosses are laggy in fast markets — many pros find 12/26/9 too slow",
      "Whipsaws hard in low-volatility chop and sideways markets",
      "Default 12/26/9 is daily-bar convention; smaller bars need adjustment",
      "Raw MACD is in absolute price units — fine within one instrument, but poor for cross-asset or long-history comparison. Use PPO (percentage-based) for those",
      "Crossovers at extremes often signal momentum slowing rather than continuation",
    ],
    synergy: [
      "200-period MA as a higher-timeframe trend filter",
      "RSI for divergence cross-confirmation",
      "PPO when comparing momentum across stocks at different price levels",
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
      "Crossovers in the 20-80 neutral zone are unreliable — only trade extreme-zone signals",
      "Hidden divergence = trend continuation",
    ],
    pitfalls: [
      "Stays pinned at extremes during strong trends — fade signals fail in trends",
      "Selling every cross above 80 in a bull market is counter-trend trading",
      "'Overbought' does NOT mean sell, 'oversold' does NOT mean buy without trend context",
      "Very sensitive to lookback choice",
    ],
    synergy: [
      "Higher-timeframe trend filter (200 MA) — only take bullish crosses in uptrend, bearish in downtrend",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      kPeriod: "14 standard for swing — %K lookback",
      dPeriod: "3 standard smoothing for signal line",
      slowing:
        "trendcraft default = 3 (Slow Stochastic). slowing=1 = Fast Stochastic. With all three knobs exposed this is sometimes called the 'Full Stochastic' configured to slow defaults",
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
      "+DI/-DI crossovers are frequent without an ADX filter — Wilder's original system gated on ADX > 25; later chartists relaxed to ADX > 20-25",
    ],
    synergy: [
      "RSI gated by ADX < 20 for clean range fades",
      "MACD gated by ADX > 25 for clean trend follows",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "14 is the Wilder standard for both DI and ADX smoothing",
      adxPeriod: "14 default — separate ADX smoothing window in trendcraft impl",
    },
  },
  {
    kind: "cci",
    displayName: "Commodity Channel Index",
    category: "momentum",
    oneLiner:
      "Scaled distance of typical price from its SMA; Lambert's 0.015 constant targets most readings into ±100.",
    whenToUse: [
      "Detecting cyclical overbought/oversold in ranges (±100 fade signals)",
      "Catching breakout momentum past ±100 in trending markets",
      "Spotting divergence between price and CCI",
    ],
    signals: [
      "CCI > +100 = overbought (range fade) OR strong bullish breakout (trend follow) — interpretation depends on regime",
      "CCI < -100 = oversold (range fade) OR strong bearish breakdown (trend follow)",
      "±200 is practitioner shorthand for a much rarer extreme reading — useful as a stronger exhaustion filter",
      "Reverse-cross of ±100 = trend exhaustion in extended moves",
    ],
    pitfalls: [
      "Unbounded — extreme values do not have a fixed ceiling, unlike RSI/Stochastics",
      "±100 means different things in trends vs ranges — never trade CCI without regime context",
      "Whipsaws in low-volatility regimes",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "20 default (Lambert's original) — not 14 like RSI",
      constant:
        "0.015 (Lambert's constant) — designed to keep most readings in ±100 (proportion is period-dependent, often cited around ~70-80%); do not change without reason",
      source:
        "hlc3 (typical price) is the canonical input, not close — trendcraft default reflects this",
    },
  },
  {
    kind: "roc",
    displayName: "Rate of Change",
    category: "momentum",
    oneLiner: "Percent change of price over N bars — pure momentum.",
    whenToUse: ["Cross-asset momentum ranking", "Filtering trades by momentum strength threshold"],
    signals: [
      "ROC > 0 with rising slope = accelerating uptrend",
      "ROC crosses from below zero to above zero = bullish momentum shift",
      "ROC crosses from above zero to below zero = bearish momentum shift",
      "Divergence with price = trend exhaustion warning",
    ],
    pitfalls: [
      "No bounded interpretation — needs comparable peers or historical context",
      "Sensitive to gaps and outlier bars (uses single point n bars ago, not an average)",
      "Best used as confirmation, not standalone signal",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "12 standard; 12-21 smooths well for swing trading; longer for stable indices",
    },
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
    signals: [
      "%R below -80 = oversold (potential bounce in range)",
      "%R above -20 = overbought (potential pullback in range)",
      "Mathematically the inverse of Fast Stochastic %K — a Stoch reading of 80 = -20 on Williams %R",
    ],
    pitfalls: [
      "Same as stochastics — gets stuck in extremes during strong trends",
      "Fast oscillator: noisy without higher-timeframe trend confirmation",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "14 default suits daily charts; 7 for shorter cycles",
    },
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
    signals: [
      "CRSI < 10 = oversold (Larry Connors' standard/default threshold; stricter 5/95 variants also used)",
      "CRSI > 90 = overbought (Larry Connors' standard/default threshold)",
      "In an uptrend filter, CRSI < 10 is a high-probability pullback buy",
    ],
    pitfalls: [
      "Designed for daily US equities; less reliable on FX or 24h crypto",
      "Streak component is sensitive to gap-driven false streaks",
      "ROC percentile component requires `rocPeriod` bars of warmup (default 100) before CRSI is non-null",
    ],
    synergy: ["200-day MA as trend filter to avoid catching falling knives"],
    marketRegime: ["ranging", "trending"],
    timeframe: ["swing"],
    paramHints: {
      rsiPeriod: "3 default — intentionally short for fast mean reversion",
      streakPeriod: "2 default — RSI of consecutive up/down day count",
      rocPeriod: "100 default — percentile lookback over 1-day ROC",
    },
  },
];
