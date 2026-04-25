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
  {
    kind: "stochRsi",
    displayName: "Stochastic RSI",
    category: "momentum",
    oneLiner:
      "Tushar Chande & Stanley Kroll's stochastic applied to RSI values — more sensitive than plain RSI.",
    whenToUse: [
      "When plain RSI rarely reaches extremes and you want more frequent OB/OS signals",
      "Short-term mean reversion in ranges",
      "Confirming RSI reversals with %K/%D crossovers",
    ],
    signals: [
      "StochRSI > 80 = overbought (Chande/Kroll's threshold, stricter than RSI's 70)",
      "StochRSI < 20 = oversold (stricter than RSI's 30)",
      "Above 0.5 (50%) sustained = uptrend bias; below 0.5 = downtrend bias",
      "%K crosses above %D in <20 zone = oversold reversal cue",
    ],
    pitfalls: [
      "Indicator-of-an-indicator — amplifies noise as well as signal",
      "Spends extended time pinned at 0 or 100 in strong trends",
      "Output scale depends on platform: trendcraft outputs 0-100, some platforms use 0-1",
    ],
    synergy: [
      "Plain RSI for divergence cross-check",
      "Higher-timeframe trend filter (200 MA) to gate signals",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      rsiPeriod: "14 default — RSI lookback (Chande/Kroll's original)",
      stochPeriod: "14 default — high/low window applied to RSI",
      kPeriod: "3 default — %K smoothing",
      dPeriod: "3 default — %D (signal) smoothing",
    },
  },
  {
    kind: "trix",
    displayName: "TRIX",
    category: "momentum",
    oneLiner:
      "Jack Hutson's 1-period rate of change of a triple-smoothed EMA; filters noise to expose the underlying trend.",
    whenToUse: [
      "Trend-following with built-in noise filtering",
      "Signal-line crossover systems where MACD whipsaws too much",
      "Divergence detection against price",
    ],
    signals: [
      "TRIX > 0 = uptrend; TRIX < 0 = downtrend",
      "TRIX crosses above signal line = bullish",
      "TRIX crosses below signal line = bearish",
      "Divergence with price = trend exhaustion warning",
    ],
    pitfalls: [
      "Triple-smoothing means significant lag at trend turns",
      "trendcraft impl is more permissive about warmup than canonical TRIX: null EMA values are treated as 0 inside the nested EMA passes, so TRIX becomes non-null around index `period` rather than after a strict 3-stage EMA warmup. Early values may differ from references like StockCharts until all three EMAs are fully populated",
      "Crossovers in flat/zero-line areas produce whipsaws",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "15 default for the triple-EMA smoothing (Hutson's original)",
      signalPeriod: "9 default for the EMA-based signal line",
    },
  },
  {
    kind: "aroon",
    displayName: "Aroon",
    category: "momentum",
    oneLiner:
      "Tushar Chande's time-since-high/low indicator — measures how recently the period's extremes printed.",
    whenToUse: [
      "Detecting whether a market is trending or ranging",
      "Identifying the start of a new trend (Aroon-Up or -Down crossing 70)",
      "Confirming ADX-style trend strength with a complementary lens (time vs price)",
    ],
    signals: [
      "Aroon-Up > 70 with Aroon-Down < 30 = strong uptrend underway",
      "Aroon-Down > 70 with Aroon-Up < 30 = strong downtrend underway",
      "Aroon-Up crosses above Aroon-Down = bullish trend ignition",
      "Oscillator (Up - Down) > 0 = bullish bias; < 0 = bearish; near 0 = ranging",
    ],
    pitfalls: [
      "Lags the trend — confirms after the high/low has printed",
      "Best used as confirmation, not entry trigger; a single Aroon reading is rarely tradeable alone",
      "On 25-period default, requires 25+ bars before first non-null reading",
    ],
    synergy: ["ADX/DMI to cross-confirm trend strength from a price-momentum angle"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "25 default (Chande's original recommendation)",
    },
  },
  {
    kind: "awesomeOscillator",
    displayName: "Awesome Oscillator",
    category: "momentum",
    oneLiner:
      "Bill Williams' SMA(median, 5) - SMA(median, 34) histogram — momentum from median (high+low)/2 prices.",
    whenToUse: [
      "Visual momentum gauge alongside Bill Williams' broader trading system",
      "Bill Williams' 'Saucer' and 'Twin Peaks' patterns for entries",
      "Zero-line crossovers as trend direction shifts",
    ],
    signals: [
      "AO > 0 = bullish momentum; AO < 0 = bearish momentum",
      "Saucer (bullish): 3-bar reversal above zero where bar 2 is red (lower than bar 1) and bar 3 is green (higher than bar 2)",
      "Twin Peaks (bullish): two troughs below zero with the second trough higher than the first, while the bars between stay below zero, followed by a green bar",
      "Zero-line crossover = trend direction shift",
    ],
    pitfalls: [
      "Median-price input ignores close, which discards intra-bar information",
      "Default 5/34 has a long warmup (34 bars before first non-null)",
      "Saucer/Twin Peaks are pattern-based — coding them reliably is non-trivial",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing"],
    paramHints: {
      fastPeriod: "5 default (Bill Williams' original)",
      slowPeriod: "34 default (Bill Williams' original)",
    },
  },
  {
    kind: "ppo",
    displayName: "Percentage Price Oscillator",
    category: "momentum",
    oneLiner:
      "MACD-equivalent expressed as percentage — comparable across instruments with different price levels.",
    whenToUse: [
      "Cross-asset momentum comparison (where MACD's absolute units fail)",
      "Divergence detection with price-level-independent magnitude",
      "Replacement for MACD in long-history backtests where price scale changes significantly",
    ],
    signals: [
      "PPO crosses above signal = bullish momentum shift",
      "PPO crosses below signal = bearish momentum shift",
      "Histogram peaks/troughs = momentum acceleration/deceleration",
      "Zero-line crossovers = longer-term trend direction change",
    ],
    pitfalls: [
      "Same lag/whipsaw issues as MACD in chop or low-volatility regimes",
      "Less name-recognition than MACD — harder to communicate signals to non-quant audiences",
      "Default 12/26/9 inherited from MACD; same daily-bar convention caveats apply",
      "PPO normalizes before the signal EMA, so PPO signal/histogram timing can diverge from MACD's — not a strict cosmetic rescale",
    ],
    synergy: [
      "Use PPO instead of MACD when comparing momentum across stocks at different price levels",
      "Higher-timeframe trend filter for direction bias",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      fastPeriod: "12 standard (MACD parity)",
      slowPeriod: "26 standard",
      signalPeriod: "9 standard",
    },
  },
  {
    kind: "tsi",
    displayName: "True Strength Index",
    category: "momentum",
    oneLiner:
      "William Blau's double-smoothed momentum oscillator — momentum filtered by two nested EMAs.",
    whenToUse: [
      "Trend-following with smoother momentum than MACD/PPO",
      "Divergence detection on swing/position timeframes",
      "Zero-line crossovers as longer-term trend cues",
    ],
    signals: [
      "TSI > 0 = bullish momentum; TSI < 0 = bearish momentum",
      "TSI crosses above signal line = bullish entry cue",
      "TSI crosses below signal line = bearish entry cue",
      "Divergence with price = trend exhaustion",
    ],
    pitfalls: [
      "Double smoothing creates significant lag at sharp turns",
      "Signal-line crossovers are 'quite frequent' (StockCharts) — require additional filtering",
      "Blau's defaults (25/13/7) tuned for daily charts; intraday/longer needs adjustment",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      longPeriod: "25 default — first (long) EMA of momentum",
      shortPeriod: "13 default — second (short) EMA of long-smoothed momentum",
      signalPeriod: "7 default — EMA of TSI for the signal line",
    },
  },
  {
    kind: "ultimateOscillator",
    displayName: "Ultimate Oscillator",
    category: "momentum",
    oneLiner:
      "Larry Williams' weighted average of buying-pressure ratios across three timeframes (4:2:1).",
    whenToUse: [
      "OB/OS detection that's more robust than single-timeframe oscillators",
      "Divergence-based entry systems (Williams' canonical use)",
    ],
    signals: [
      "UO > 70 = overbought; UO < 30 = oversold",
      "Bullish divergence formed below 30, then UO rises above the divergence high = buy signal (Williams' three-step setup)",
      "Bearish divergence formed above 70, then UO falls below the divergence low = sell signal",
    ],
    pitfalls: [
      "Three-period weighting (4:2:1) is fixed by Williams' design — alternatives are non-canonical",
      "Multi-timeframe averaging dampens reaction speed — late entries on fast moves",
      "Long warmup: needs `period3` bars (28 default) before first non-null",
    ],
    marketRegime: ["ranging", "trending"],
    timeframe: ["swing"],
    paramHints: {
      period1: "7 default — short timeframe (highest weight in 4:2:1)",
      period2: "14 default — medium timeframe",
      period3: "28 default — long timeframe (lowest weight)",
    },
  },
  {
    kind: "stc",
    displayName: "Schaff Trend Cycle",
    category: "momentum",
    oneLiner:
      "Doug Schaff's (publicly released ~2008) double-smoothed Stochastic of MACD — bounded 0-100 trend cycle indicator.",
    whenToUse: [
      "Faster reversal cues than MACD with built-in OB/OS bounds",
      "Trend cycle identification across instruments where MACD lags",
    ],
    signals: [
      "STC > 75 = overbought zone (uptrend likely tiring)",
      "STC < 25 = oversold zone",
      "STC crosses up through 25 = end of oversold, potential long entry",
      "STC crosses down through 75 = end of overbought, potential short entry",
    ],
    pitfalls: [
      "Combines MACD lag with double-smoothed Stochastic — interpretation requires understanding both layers",
      "Whipsaws hard in chop despite the smoothing, especially on shorter timeframes",
      "Default 23/50/10 differs from MACD's 12/26/9 — not a direct drop-in replacement",
      "Long warmup: needs `slowPeriod` (50) bars for the inner MACD plus the two Stochastic passes — first non-null is well past 60 bars on defaults",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      fastPeriod: "23 default — fast EMA for the underlying MACD (Schaff's original)",
      slowPeriod: "50 default — slow EMA",
      cyclePeriod: "10 default — Stochastic cycle length applied to MACD values",
    },
  },
  {
    kind: "cmo",
    displayName: "Chande Momentum Oscillator",
    category: "momentum",
    oneLiner:
      "Tushar Chande's pure momentum oscillator using both up and down moves; bounded -100 to +100.",
    whenToUse: [
      "OB/OS detection without RSI's denominator-asymmetry issues",
      "Zero-line crossovers as trend direction shifts",
      "Divergence with price",
    ],
    signals: [
      "CMO > +50 = overbought",
      "CMO < -50 = oversold",
      "Zero-line crossover = trend direction change",
      "Divergence with price = trend exhaustion warning",
    ],
    pitfalls: [
      "Tushar Chande's original CMO used raw sums (no smoothing); trendcraft impl uses Wilder's smoothing to match TA-Lib — values differ from the strict-original CMO",
      "Stays at extremes during strong trends like RSI",
      "Chande's recommended period: 9 for daily (high sensitivity); trendcraft default 14 favors swing-style stability",
    ],
    marketRegime: ["ranging"],
    timeframe: ["swing"],
    paramHints: {
      period:
        "14 default in trendcraft (TA-Lib parity). Chande's original recommended 9 for daily charts",
    },
  },
  {
    kind: "imi",
    displayName: "Intraday Momentum Index",
    category: "momentum",
    oneLiner:
      "Tushar Chande's RSI-style oscillator using open-to-close moves instead of close-to-close.",
    whenToUse: [
      "Day trading where intraday open-to-close conviction matters more than overnight gaps",
      "Filtering RSI signals on instruments where close-to-close changes are dominated by overnight moves",
    ],
    signals: [
      "IMI > 70 = overbought intraday (common default; some traders use stricter 80/20)",
      "IMI < 30 = oversold intraday",
      "Crosses through 50 with volume confirmation = intraday momentum shift",
    ],
    pitfalls: [
      "Sums of raw gains/losses (no Wilder smoothing) — values are jumpier than RSI",
      "On instruments with frequent gaps, results differ markedly from RSI; don't treat them as interchangeable",
      "Less battle-tested than RSI; fewer canonical reference values to cross-check against",
    ],
    marketRegime: ["ranging"],
    timeframe: ["intraday"],
    paramHints: {
      period: "14 default rolling-sum window",
    },
  },
  {
    kind: "vortex",
    displayName: "Vortex Indicator",
    category: "momentum",
    oneLiner:
      "Etienne Botes & Douglas Siepman's VI+/VI- pair (S&C Jan 2010) — trend ignition via crossovers.",
    whenToUse: [
      "Identifying the start of a new trend",
      "Confirming an existing trend's continuation",
      "Alternative to DMI/+DI/-DI with a different formulation (uses cross-bar high-low distances)",
    ],
    signals: [
      "VI+ > VI- = uptrend",
      "VI- > VI+ = downtrend",
      "VI+ crosses above VI- = bullish trend ignition",
      "VI- crosses above VI+ = bearish trend ignition",
      "Botes/Siepman canonical entry: enter at the crossing bar's extreme high (long) or low (short), not at the close",
    ],
    pitfalls: [
      "Crossovers are frequent in chop — needs a regime filter (ADX or Choppiness) for clean signals",
      "Less well-known than ADX/DMI; tools and reference values are sparser",
      "TR-normalized denominator can produce extreme readings in low-volatility periods",
    ],
    synergy: [
      "ADX/Choppiness Index regime filter",
      "DMI for cross-confirmation when both indicators agree on trend direction",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      period:
        "14 is the common default used across most platforms and in Botes/Siepman's original tests. Common range: 14-30",
    },
  },
  {
    kind: "dpo",
    displayName: "Detrended Price Oscillator",
    category: "momentum",
    oneLiner:
      "Removes the trend component to isolate price cycles by comparing price to a backshifted SMA.",
    whenToUse: [
      "Cycle analysis — finding rhythmic peaks and troughs independent of trend",
      "Building a regime-aware system that needs cycle phase as a separate input",
      "Estimating typical cycle length when paired with peak/trough detection",
    ],
    signals: [
      "DPO > 0 = price above its detrended baseline (cycle high)",
      "DPO < 0 = price below baseline (cycle low)",
      "Zero crossings = cycle turning points",
    ],
    pitfalls: [
      "DPO is plotted displaced into the past — the last `period/2 + 1` bars are simply undefined on a centered chart. Does NOT require future market data; it is just not aligned to the latest bar",
      "Cycle detection assumes the period roughly matches the dominant cycle length; mismatched periods produce noise rather than signal",
      "Don't use as an entry trigger by itself — it's a context indicator",
    ],
    marketRegime: ["ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "20 default — half-cycle lookback for the SMA, shifted back period/2+1 = 11 bars",
    },
  },
  {
    kind: "kst",
    displayName: "Know Sure Thing",
    category: "momentum",
    oneLiner:
      "Martin Pring's weighted sum of four smoothed ROCs (1992) — multi-timeframe momentum oscillator.",
    whenToUse: [
      "Long-term trend confirmation across multiple ROC timeframes",
      "Signal-line crossover systems that smooth out single-timeframe noise",
      "Trend-line breaks on the KST line itself (Pring's preferred technique)",
    ],
    signals: [
      "KST > 0 = bullish; KST < 0 = bearish",
      "KST crosses above signal = bullish entry cue",
      "KST crosses below signal = bearish entry cue",
      "Trend-line breaks on KST line itself (Pring's signature method)",
    ],
    pitfalls: [
      "Many parameters (4 ROC + 4 SMA + weights + signal) — easy to overfit",
      "Defaults are tuned for daily charts; intraday or longer timeframes need re-tuning",
      "Signal-line crossovers can be late on fast moves due to multi-timeframe smoothing",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      rocPeriods:
        "[10, 15, 20, 30] default — four ROC timeframes from short to long (Pring's original)",
      smaPeriods: "[10, 10, 10, 15] default — SMA smoothing on each ROC",
      weights: "[1, 2, 3, 4] default — shortest ROC gets weight 1, longest gets 4",
      signalPeriod: "9 default — SMA of KST for signal line",
    },
  },
  {
    kind: "massIndex",
    displayName: "Mass Index",
    category: "momentum",
    oneLiner:
      "Donald Dorsey's range-expansion-based reversal indicator using nested EMAs of (high - low).",
    whenToUse: [
      "Predicting trend reversals when the high-low range expands then contracts",
      "Confirming reversal signals from other indicators with a non-price-direction lens",
    ],
    signals: [
      "Reversal Bulge: Mass Index rises above 27, then drops below 26.5 = potential reversal imminent",
      "Direction NOT given by Mass Index — use 9-period EMA trend/slope as the directional filter: a reversal bulge in a downtrend suggests a buy setup; in an uptrend, a sell setup (Dorsey's canonical procedure)",
    ],
    pitfalls: [
      "Direction-agnostic — Mass Index alone cannot tell you bullish vs bearish",
      "27/26.5 thresholds are Dorsey's empirical levels — they don't transfer cleanly to all instruments/timeframes",
      "Long warmup: nested 9-period EMAs plus 25-bar sum require ~50+ bars before stable",
    ],
    synergy: ["EMA(9) of price as the directional companion (Dorsey's recommended pairing)"],
    marketRegime: ["volatile"],
    timeframe: ["swing", "position"],
    paramHints: {
      emaPeriod: "9 default — single and double EMA of (high - low) range",
      sumPeriod: "25 default — summation window for the EMA ratio",
    },
  },
  {
    kind: "qstick",
    displayName: "QStick",
    category: "momentum",
    oneLiner:
      "Tushar Chande's moving average of (close - open) — measures aggregate buying vs selling pressure within bars.",
    whenToUse: [
      "Detecting bar-by-bar buying/selling pressure when intra-bar action matters",
      "Confirming trend direction with a complementary lens to close-to-close oscillators",
    ],
    signals: [
      "QStick > 0 = closes above opens on average (buying pressure)",
      "QStick < 0 = closes below opens on average (selling pressure)",
      "Zero-line crossover = sentiment shift",
    ],
    pitfalls: [
      "Uses ONLY open/close — ignores high/low and intra-bar range",
      "On instruments where opens are unreliable (some FX, after-hours), QStick is noisy",
      "Less name-recognition; sparse reference data for cross-validation",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "14 default SMA window",
    },
  },
  {
    kind: "coppockCurve",
    displayName: "Coppock Curve",
    category: "momentum",
    oneLiner:
      "Edwin Coppock's 1962 long-term buy-signal indicator originally designed for monthly S&P 500 / DJIA.",
    whenToUse: [
      "Long-term position-trade entries on broad equity indexes (Coppock's original use case)",
      "Identifying major bottoms after bear markets when curve turns up from below zero",
    ],
    signals: [
      "Buy signal: curve turns upward from below zero (Coppock's canonical signal)",
      "Sell signal NOT given by Coppock — he treated this as a buy-only system",
    ],
    pitfalls: [
      "Originally designed for MONTHLY data — applying to daily/intraday materially changes its character",
      "14- and 11-month ROC periods come from a commonly-repeated anecdotal origin story (the '11-14 month grief period' that Coppock supposedly used); not a quantitatively-derived choice",
      "Pure long signal — doesn't tell you when to exit",
      "Lagging: turns up well after the bottom prints",
    ],
    marketRegime: ["trending"],
    timeframe: ["position"],
    paramHints: {
      wmaPeriod: "10 default — WMA smoothing on combined ROC sum (Coppock's original)",
      longRocPeriod: "14 default — long ROC period",
      shortRocPeriod: "11 default — short ROC period",
    },
  },
  {
    kind: "balanceOfPower",
    displayName: "Balance of Power",
    category: "momentum",
    oneLiner:
      "Igor Levshin's bar-shape oscillator: (close - open) / (high - low), smoothed by SMA. Range -1 to +1.",
    whenToUse: [
      "Detecting buyer/seller dominance from bar shape",
      "Cross-confirming trend direction with a non-momentum, non-volume signal",
    ],
    signals: [
      "BOP > 0 = buyers in charge (close above open within range)",
      "BOP < 0 = sellers in charge",
      "Reading near zero = balance / indecision, sometimes precedes trend reversal",
    ],
    pitfalls: [
      "Bars with high=low (range=0) are undefined — trendcraft handles via fallback",
      "Single-bar BOP (smoothing=1) is very noisy; default 14-period smoothing is the canonical",
      "Doesn't capture volume or close-to-close moves — combine with OBV/CMF for fuller picture",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      smoothPeriod:
        "14 default SMA smoothing (canonical for daily charts). Set to 1 for raw, unsmoothed BOP",
    },
  },
  {
    kind: "hurst",
    displayName: "Hurst Exponent",
    category: "momentum",
    oneLiner:
      "Rescaled Range (R/S) analysis estimator of long-term memory: H>0.5 trending, H<0.5 mean-reverting, H≈0.5 random walk.",
    whenToUse: [
      "Regime classification: deciding whether to deploy a trend-following or mean-reversion strategy",
      "Quantifying market efficiency / persistence of returns",
      "Long-term portfolio analytics (returns persistence)",
    ],
    signals: [
      "H > 0.5 = trending / persistent — favor trend-following strategies",
      "H < 0.5 = mean-reverting / anti-persistent — favor mean-reversion strategies",
      "H ≈ 0.5 = random walk — markets behave efficiently, edge is hard",
      "H ≈ 1.0 = strong trend persistence; H ≈ 0.0 = strong mean reversion",
    ],
    pitfalls: [
      "R/S analysis is sensitive to short-term outliers and the chosen window range",
      "Estimation noise is high on small samples; 100+ bars is a practical minimum",
      "Hurst is a STATISTIC, not a tradeable signal — don't enter trades because H crossed 0.5",
      "Different estimation methods (R/S vs DFA vs Whittle) yield different H values; trendcraft uses R/S",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      minWindow: "20 default — smallest sub-window in R/S analysis",
      maxWindow: "100 default — largest sub-window / total lookback",
    },
  },
  {
    kind: "adxr",
    displayName: "ADX Rating (ADXR)",
    category: "momentum",
    oneLiner: "Wilder's smoothed ADX: average of current ADX and ADX from `period - 1` bars ago.",
    whenToUse: [
      "Smoother trend-strength filter than raw ADX for slower systems",
      "Wilder's original Directional Movement system entry filter (ADXR > 25)",
    ],
    signals: [
      "ADXR > 25 = strong trend (Wilder's threshold to enable trend-following entries)",
      "ADXR < 20 = weak trend / range — Wilder's rule: do NOT trade trend-following systems",
    ],
    pitfalls: [
      "Direction-agnostic — never use alone for entries (use +DI/-DI for direction)",
      "Smoothing makes ADXR slightly less responsive than ADX — late on fresh trend ignition",
      "Long warmup: requires DMI/ADX warmup PLUS the `period` lookback for the rating average",
    ],
    synergy: [
      "+DI / -DI from DMI for direction once ADXR > 25",
      "Higher-timeframe ADXR for regime confirmation",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "14 default — ADXR rating lookback (Wilder's original)",
      dmiPeriod: "14 default — DMI/ATR smoothing",
      adxPeriod: "14 default — ADX smoothing window",
    },
  },
];
