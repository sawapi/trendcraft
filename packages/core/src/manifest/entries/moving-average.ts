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
  {
    kind: "wma",
    displayName: "Weighted Moving Average",
    category: "moving-average",
    oneLiner: "Linearly-weighted MA: most recent bar weighted N, oldest weighted 1.",
    whenToUse: [
      "Short-term trend following where SMA's lag is too costly",
      "Building block for HMA and other lag-reducing averages",
      "When a precise, deterministic weighting scheme is preferred over EMA's recursive nature",
    ],
    signals: [
      "Price above rising WMA = bullish bias",
      "WMA cross of two periods = momentum shift (faster than SMA cross)",
    ],
    pitfalls: [
      "Faster than SMA but choppier — more false signals in noisy markets",
      "Linear weights still include older prices; reacts more slowly than EMA on sharp moves",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "Required. Common: 20 short-term, 50 medium",
    },
  },
  {
    kind: "dema",
    displayName: "Double Exponential Moving Average",
    category: "moving-average",
    oneLiner: "Patrick Mulloy's lag-reduced EMA: 2×EMA - EMA(EMA).",
    whenToUse: [
      "Trend following where standard EMA lag is unacceptable",
      "Short-term swing entries on directional moves",
      "Replacement for EMA in MACD-style systems wanting faster signals",
    ],
    signals: [
      "Price above rising DEMA = bullish bias with reduced lag vs EMA",
      "DEMA cross of two periods = earlier momentum shift than EMA cross",
    ],
    pitfalls: [
      "Reduced lag comes with more whipsaws in chop",
      "More complex to interpret than plain EMA — overshoots are characteristic, not anomalies",
      "Introduced 1994 by Patrick Mulloy; less battle-tested than SMA/EMA",
      "Warmup of 2×period - 1 bars before first non-null value (the inner EMA-of-EMA needs the outer EMA populated first)",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "20 default — same convention as Mulloy's original Stocks & Commodities article",
    },
  },
  {
    kind: "tema",
    displayName: "Triple Exponential Moving Average",
    category: "moving-average",
    oneLiner: "Patrick Mulloy's three-fold EMA composition: 3×EMA1 - 3×EMA2 + EMA3.",
    whenToUse: [
      "Trend following with even less lag than DEMA",
      "Short-term systems that need crossovers to fire earlier than DEMA's",
    ],
    signals: [
      "TEMA crossovers typically happen earlier than corresponding DEMA or EMA crossovers",
      "Price above rising TEMA = strong bullish bias",
    ],
    pitfalls: [
      "Even more whipsaws than DEMA in chop — faster reaction = more noise",
      "Three nested EMAs amplify any seed-method differences across implementations",
      "Warmup of 3×period - 2 bars before first non-null value (e.g. period=20 needs 58 bars)",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "20 default — same convention as DEMA",
    },
  },
  {
    kind: "zlema",
    displayName: "Zero-Lag Exponential Moving Average",
    category: "moving-average",
    oneLiner: "John Ehlers/Ric Way's de-lagged EMA: EMA(2×price - price[lag], period).",
    whenToUse: [
      "Trend following where DEMA/TEMA still feel laggy",
      "Building block for systems that compose with EMAs",
    ],
    signals: [
      "Price above rising ZLEMA = bullish bias with minimal lag",
      "ZLEMA color/slope change = early reversal cue",
    ],
    pitfalls: [
      "'Zero lag' is a marketing label — lag is reduced, not eliminated",
      "More false reversals in choppy markets than EMA",
      "Introduced ~2010 — less battle-tested than older MAs",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period:
        "20 default. trendcraft impl uses lag = floor((period-1)/2). Ehlers' typical guidance: 9 intraday, 20 swing, 40-50 position",
    },
  },
  {
    kind: "alma",
    displayName: "Arnaud Legoux Moving Average",
    category: "moving-average",
    oneLiner:
      "Gaussian-weighted MA with tunable offset (smoothness↔responsiveness) and sigma (width).",
    whenToUse: [
      "When a smooth-yet-responsive MA is needed and EMA-family overshoots are unwanted",
      "Custom weighting profiles via offset/sigma tuning",
    ],
    signals: ["Price above rising ALMA = bullish bias", "Slope change = trend shift cue"],
    pitfalls: [
      "Two extra parameters (offset, sigma) make tuning harder than EMA",
      "Less name-recognition with traders — harder to explain in strategy reviews",
      "Per-bar Gaussian recompute is more expensive than recursive EMA",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "9 default in trendcraft impl. Larger windows (e.g. 50) also seen on some platforms",
      offset:
        "0.85 default. Range 0-1: closer to 1 centers the Gaussian on recent bars (more responsive / less lag); closer to 0 centers earlier (smoother / more lag)",
      sigma:
        "6 default. trendcraft uses s = period / sigma, so higher sigma = narrower bell = more responsive; lower sigma = broader bell = smoother",
    },
  },
  {
    kind: "frama",
    displayName: "Fractal Adaptive Moving Average",
    category: "moving-average",
    oneLiner:
      "John Ehlers' MA with smoothing factor driven by the price series' fractal dimension.",
    whenToUse: [
      "Mixed-regime markets where a fixed-period MA over- or under-reacts",
      "Following strong trends while slowing during consolidation, similar to KAMA",
    ],
    signals: [
      "Price above rising FRAMA = bullish bias with regime-aware smoothing",
      "Flat FRAMA = price acting like a 2D random walk (high fractal dimension) — avoid trend trades",
    ],
    pitfalls: [
      "trendcraft impl silently rounds odd periods up to the next even number (e.g. period=5 becomes effectivePeriod=6) — to halve the lookback for the two sub-range fractals",
      "Less intuitive to tune than fixed-period or KAMA-style MAs",
      "Adaptive smoothing can mask genuine trend changes when the fractal estimate stays high",
      "Sensitive to zero-range source windows (computed from the configured source series, default close, not high/low) — when sub-range becomes 0 trendcraft falls back to alpha=0.01",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period:
        "16 default. Must be integer >= 4. Even values are canonical — odd values rounded up by trendcraft impl",
    },
  },
  {
    kind: "mcginley",
    displayName: "McGinley Dynamic",
    category: "moving-average",
    oneLiner:
      "John R. McGinley's self-adjusting MA that speeds up in fast markets and slows in chop.",
    whenToUse: [
      "EMA replacement when you want automatic adaptation to volatility without tuning",
      "Trend following on swing/position timeframes",
    ],
    signals: [
      "Price above rising McGinley = bullish bias",
      "McGinley flattens during chop — visual regime cue",
    ],
    pitfalls: [
      "(close/MD)^4 term can cause aggressive jumps when price diverges sharply from the MA — mitigated by k constant but still worth watching",
      "Less name-recognition than EMA family — harder to explain to non-quant audiences",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      period: "14 default lookback (N in McGinley's formula)",
      k: "0.6 default constant (60% adjustment, McGinley's original recommendation)",
    },
  },
  {
    kind: "emaRibbon",
    displayName: "EMA Ribbon",
    category: "moving-average",
    oneLiner:
      "Multiple EMAs (Fibonacci periods by default) plotted together for trend alignment visualization.",
    whenToUse: [
      "At-a-glance trend strength: stacked alignment = strong trend, tangled = chop",
      "Multi-timeframe trend bias on a single chart",
      "Ribbon expansion/contraction as a regime cue",
    ],
    signals: [
      "Bullish: shorter EMAs above longer ones, properly stacked (e.g. EMA8 > EMA13 > EMA21 > EMA34 > EMA55)",
      "Bearish: shorter EMAs below longer ones",
      "Ribbon expanding = trend strengthening; contracting = trend weakening / regime shift",
      "Tangled / overlapping ribbon = no clear trend, chop regime",
    ],
    pitfalls: [
      "Visual indicator — alignment is qualitative; thresholds for 'expanding' vs 'tangled' need codification",
      "Lots of crossovers in chop produce noisy partial-alignment states",
      "Default Fibonacci periods (8/13/21/34/55) work for swing; smaller stacks needed intraday",
    ],
    synergy: ["ADX or Choppiness regime filter to suppress ribbon entries during tangled states"],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      periods:
        "[8, 13, 21, 34, 55] Fibonacci default. Common alternatives: [5, 8, 13, 21, 34] (faster) or [10, 20, 30, 40, 50] (uniform)",
    },
  },
];
