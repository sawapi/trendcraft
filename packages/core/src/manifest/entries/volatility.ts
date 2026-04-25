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
  {
    kind: "chandelierExit",
    displayName: "Chandelier Exit",
    category: "volatility",
    oneLiner:
      "Charles Le Beau's ATR-based trailing stop that 'hangs' from the period high (long) or low (short).",
    whenToUse: [
      "Trailing stop placement on trend trades — stays loose in volatile periods, tightens in calm",
      "Letting winners run while protecting profits in established trends",
    ],
    signals: [
      "Long exit: close below long Chandelier (period-high - 3×ATR by default)",
      "Short exit: close above short Chandelier (period-low + 3×ATR)",
      "Trend direction: price above long Chandelier = bullish; below short Chandelier = bearish",
    ],
    pitfalls: [
      "Late on trend reversals — by the time price closes through the chandelier the trend is well over",
      "On choppy ranges, chandelier oscillates and offers no protection",
      "Period and multiplier need recalibration across instruments / timeframes",
    ],
    synergy: [
      "ADX or Choppiness regime filter to disable chandelier in chop",
      "Use as an exit stop, not entry trigger",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "22 default (Le Beau's classic)",
      multiplier: "3.0 default ATR multiplier (Le Beau's classic)",
      lookback:
        "Optional separate lookback for the high/low; defaults to `period` if not specified",
    },
  },
  {
    kind: "ulcerIndex",
    displayName: "Ulcer Index",
    category: "volatility",
    oneLiner:
      "Peter Martin's downside-only volatility measure (developed 1987, first published with Byron McCann in 1989) — depth and duration of drawdowns from period highs.",
    whenToUse: [
      "Risk-adjusted performance metrics (Ulcer Performance Index = (return - rf) / Ulcer Index)",
      "Comparing strategies/funds on downside risk rather than total volatility",
      "Long-only equity portfolio risk monitoring",
    ],
    signals: [
      "Lower UI = less drawdown stress (better for risk-averse investors)",
      "Higher UI = more drawdown stress",
      "Trend-following systems: UI rising during a position is a warning sign",
    ],
    pitfalls: [
      "Direction-specific: only measures DOWNSIDE volatility, ignores upside",
      "Useless for short strategies (would need an inverted version)",
      "Magnitude is instrument-dependent; only meaningful in relative comparison",
    ],
    synergy: ["Pair with Sharpe ratio as a downside-risk-aware alternative (Martin Ratio / UPI)"],
    marketRegime: ["trending", "volatile"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "14 default lookback",
    },
  },
  {
    kind: "historicalVolatility",
    displayName: "Historical Volatility",
    category: "volatility",
    oneLiner:
      "Annualized standard deviation of log returns — the textbook close-to-close volatility estimator.",
    whenToUse: [
      "Annualized volatility for options pricing, risk metrics, position sizing",
      "Comparing volatility across instruments at different price levels (returns are scale-invariant)",
      "Detecting volatility regime shifts when paired with rolling percentile",
    ],
    signals: [
      "Rising HV = volatility expanding (often near trend changes or news)",
      "Falling HV = volatility contracting (consolidation / coiling)",
      "Mean-reverting tendency on most equity instruments",
    ],
    pitfalls: [
      "Uses ONLY closes — ignores intra-bar information (Garman-Klass uses OHLC for ~7.4× more efficiency under its assumptions)",
      "Annualization assumes 252 trading days — adjust for crypto (365) or other markets",
      "trendcraft uses sample stddev (/N-1); some platforms use population stddev (/N) yielding slightly smaller values. Document this when comparing across platforms",
      "Past volatility ≠ future volatility — HV is descriptive, not predictive",
    ],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "20 default — short-term volatility window (10-30 typical)",
      annualFactor:
        "252 default for daily US equity. Use 365 for 24/7 crypto, 256 for some intraday conventions",
    },
  },
  {
    kind: "garmanKlass",
    displayName: "Garman-Klass Volatility",
    category: "volatility",
    oneLiner:
      "Mark Garman & Michael Klass's OHLC-based volatility estimator — ~7.4× more efficient than close-to-close HV.",
    whenToUse: [
      "Volatility estimation when fewer bars are available (small-sample efficiency)",
      "Option pricing models needing tighter volatility estimates",
      "Replacing HV when intraday range information matters",
    ],
    signals: [
      "Same regime interpretation as HV (rising = expansion, falling = contraction)",
      "Spread vs HV (close-to-close) reveals intra-bar volatility content",
    ],
    pitfalls: [
      "Assumes Brownian motion with ZERO drift — biased when drift is non-zero (e.g. sustained directional moves)",
      "Assumes NO opening jumps (overnight gaps) — biased on instruments with weekend/overnight gaps",
      "Less battle-tested in trader workflows than HV; many platforms don't expose it",
    ],
    synergy: [
      "Cross-check with HV — large divergence indicates intraday range vs close-to-close mismatch",
    ],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["swing"],
    paramHints: {
      period: "20 default — same convention as HV",
      annualFactor: "252 default for daily US equity",
    },
  },
  {
    kind: "ewmaVolatility",
    displayName: "EWMA Volatility (RiskMetrics)",
    category: "volatility",
    oneLiner:
      "Exponentially weighted moving average of squared returns — JP Morgan's RiskMetrics 1994 standard.",
    whenToUse: [
      "Risk management: VaR, position sizing, regulatory capital",
      "Volatility forecasting where recent observations should weigh more than equal-weight HV",
      "Daily portfolio variance updates without storing the full window",
    ],
    signals: [
      "Rising EWMA volatility = recent returns more dispersed than recent baseline",
      "Falling EWMA volatility = recent returns concentrating",
    ],
    pitfalls: [
      "API differs from other indicators: takes `returns: number[]`, NOT candles. Compute returns yourself first",
      "Single-parameter (λ) — convenient but inflexible compared to GARCH",
      "λ = 0.94 is RiskMetrics' daily standard; 0.97 is canonical for monthly. Don't change without reason",
      "Exponential weighting means very old returns still carry tiny weight — no clean cutoff window",
    ],
    synergy: ["GARCH for richer volatility modeling when EWMA's single λ isn't sufficient"],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["swing", "position"],
    paramHints: {
      lambda:
        "0.94 default (RiskMetrics 1994 recommendation for 1-day forecast horizon). 0.97 for 1-month horizon. Range 0 < λ < 1",
    },
  },
  {
    kind: "standardDeviation",
    displayName: "Standard Deviation",
    category: "volatility",
    oneLiner: "Rolling standard deviation of price (not returns) — direct dispersion measure.",
    whenToUse: [
      "Building block for Bollinger Bands and other volatility envelopes",
      "Z-score-style normalization of price relative to its rolling mean",
      "Cross-check with HV (which operates on log returns instead of raw price)",
    ],
    signals: [
      "Rising stddev = price dispersion expanding",
      "Falling stddev = price dispersion contracting (squeeze)",
    ],
    pitfalls: [
      "Operates on RAW PRICE, not returns — values scale with price level (compare HV for price-level-independent volatility)",
      "Population stddev (/N) used by trendcraft to match TA-Lib and Bollinger Bands convention; sample stddev (/N-1) yields slightly larger values",
      "Direction-agnostic — never use alone for entries",
    ],
    synergy: [
      "Bollinger Bands (uses this internally as the band-width source)",
      "HV when scale-independent volatility is needed",
    ],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "20 default — Bollinger Bands convention",
    },
  },
  {
    kind: "volatilityRegime",
    displayName: "Volatility Regime",
    category: "volatility",
    oneLiner:
      "Volatility-regime classifier averaging ATR percentile and Bollinger Bandwidth percentile into 'low' / 'normal' / 'high' / 'extreme'. Historical volatility is reported as metadata but does NOT enter the classification.",
    whenToUse: [
      "Strategy gating: enable/disable systems based on regime (mean-reversion in low, trend in high)",
      "Position sizing: scale size inversely with regime severity",
      "Risk management dashboards: at-a-glance current vol regime",
    ],
    signals: [
      "regime === 'low' (avg of ATR + BB percentile <= 25) — favor range / mean-reversion strategies",
      "regime === 'normal' — favor trend-following with standard sizing",
      "regime === 'high' (avg percentile >= 75) — wider stops, smaller positions",
      "regime === 'extreme' (avg percentile >= 95) — defensive, consider standing aside",
      "HV value emitted as `historicalVol` metadata for context but is NOT in the regime classification",
    ],
    pitfalls: [
      "Classification averages ATR + BB Bandwidth percentiles — large disagreement between them is masked by the average. Inspect individual percentiles when `confidence` is low",
      "Long warmup: needs `lookbackPeriod` (default 100) bars to establish percentile baseline",
      "Percentile thresholds (25/75/95) are heuristic — recalibrate per instrument if needed",
      "'Regime' is a categorical signal — implies stability that doesn't always hold (regimes flip fast around events)",
    ],
    synergy: [
      "Pair with HMM regime detection for cross-confirmation of regime classification",
      "Choppiness Index for trend-vs-range orthogonal axis",
    ],
    marketRegime: ["volatile", "low-volatility"],
    timeframe: ["swing", "position"],
    paramHints: {
      atrPeriod: "14 default — ATR window for regime input",
      bbPeriod: "20 default — Bollinger Bandwidth window",
      lookbackPeriod: "100 default — historical window for percentile ranking",
      thresholds: "{ low: 25, high: 75, extreme: 95 } percentiles by default",
    },
  },
];
