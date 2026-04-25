import type { IndicatorManifest } from "../types";

export const VOLUME_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "vwap",
    displayName: "Volume-Weighted Average Price",
    category: "volume",
    oneLiner: "Intraday volume-weighted mean price — institutional cost benchmark.",
    whenToUse: [
      "Intraday institutional fair-value reference",
      "Mean reversion to VWAP within the session",
      "Trend bias based on price position vs VWAP",
    ],
    signals: [
      "Price above VWAP = intraday bullish bias",
      "Price below VWAP = intraday bearish bias",
      "Pullback to VWAP in trend = continuation entry zone",
    ],
    pitfalls: [
      "Session-reset VWAP loses most of its intended relevance across multiple days; trendcraft offers `resetPeriod: 'rolling' | number` for non-session use",
      "Less useful pre-market or in low-volume sessions",
      "Anchored variants (anchoredVwap) are often more meaningful for multi-day context",
    ],
    synergy: [
      "VWAP ±1σ bands always emitted by trendcraft impl; pass `bandMultipliers: [2, 3]` for ±2σ/±3σ overshoot detection",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday"],
    paramHints: {
      resetPeriod:
        "'session' default (resets per trading day). 'rolling' for windowed VWAP, or number for fixed N-bar reset",
      period: "Used only when resetPeriod='rolling' — sets the rolling window length",
      bandMultipliers:
        "Extra ±N σ band pairs beyond the default ±1σ (e.g. [2, 3] adds ±2σ and ±3σ)",
    },
  },
  {
    kind: "anchoredVwap",
    displayName: "Anchored VWAP",
    category: "volume",
    oneLiner: "VWAP anchored to a specific event (earnings, swing high, session start).",
    whenToUse: [
      "Measuring participants' average cost since a key event",
      "Multi-day intraday context where regular VWAP resets",
      "Identifying resistance from prior swing highs (anchored at the high)",
    ],
    signals: [
      "Price holding above anchored VWAP from a low = bullish accumulation",
      "Rejection at anchored VWAP from a high = sellers defending",
    ],
    pitfalls: [
      "Anchor choice is subjective — bad anchors give meaningless levels",
      "Anchored to a major high → declining VWAP can act as resistance for trapped buyers selling to break even",
      "Anchored to a major low → rising VWAP can act as support for the accumulation crowd",
    ],
    synergy: [
      "trendcraft impl emits optional ±1σ and ±2σ bands when `bands: 1` or `bands: 2` is set — use for overshoot/mean-reversion zones",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      anchorTime: "Unix ms timestamp of the anchor bar — earnings, swing high/low, breakout bar",
      bands: "0 (default) = no bands. 1 = ±1σ. 2 = ±1σ and ±2σ",
    },
  },
  {
    kind: "obv",
    displayName: "On-Balance Volume",
    category: "volume",
    oneLiner: "Cumulative volume signed by close direction.",
    whenToUse: [
      "Confirming trend with volume flow",
      "Detecting accumulation/distribution divergences",
    ],
    signals: [
      "OBV makes new high with price = healthy uptrend",
      "Price new high but OBV does not = bearish divergence",
    ],
    pitfalls: [
      "Treats every up-day equally regardless of close magnitude — adds full bar volume even on tiny up-moves",
      "Cumulative absolute value is meaningless — only slope and divergences matter",
      "Misleading during gaps or when intraday action contradicts the close direction",
      "Can oscillate in sideways markets without offering clear direction",
      "Volume spikes can disrupt the indicator and require a settling period",
      "trendcraft impl seeds OBV at 0 on the first bar (some implementations seed at first-bar volume — values differ by a constant offset only)",
    ],
    synergy: ["Price chart for divergence comparison"],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
  },
  {
    kind: "mfi",
    displayName: "Money Flow Index",
    category: "volume",
    oneLiner: "Volume-weighted RSI (0-100) — momentum with volume context.",
    whenToUse: [
      "Volume-confirmed overbought/oversold detection",
      "Divergence with stronger evidence than plain RSI",
    ],
    signals: [
      "MFI < 20 = oversold with volume confirmation",
      "MFI > 80 = overbought with volume confirmation",
      "Bullish divergence (price LL, MFI HL) — stronger than plain RSI divergence due to volume weighting",
    ],
    pitfalls: [
      "Same as RSI — gets stuck in extremes during strong trends",
      "Useless on instruments with unreliable volume",
      "'Squat' pattern (MFI drops while volume rises) signals indecision, not direction",
    ],
    marketRegime: ["ranging"],
    timeframe: ["swing"],
    paramHints: {
      period: "14 standard",
    },
  },
  {
    kind: "cmf",
    displayName: "Chaikin Money Flow",
    category: "volume",
    oneLiner: "Marc Chaikin's volume-weighted accumulation/distribution oscillator (-1 to +1).",
    whenToUse: ["Detecting buying vs selling pressure", "Confirming trend with money flow"],
    signals: [
      "CMF > 0 sustained = accumulation",
      "CMF < 0 sustained = distribution",
      "Divergence with price = trend weakness",
    ],
    pitfalls: [
      "Lagging — confirms but rarely leads",
      "Sensitive to closing range within bar (close-location-value)",
      "Doji bars (close near midrange) contribute near-zero money flow regardless of volume",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing"],
    paramHints: {
      period: "20 default lookback",
    },
  },
  {
    kind: "adl",
    displayName: "Accumulation/Distribution Line",
    category: "volume",
    oneLiner: "Marc Chaikin's cumulative running sum of (close-location-value × volume).",
    whenToUse: ["Long-term accumulation/distribution divergence with price"],
    signals: [
      "ADL rising while price flat = stealth accumulation",
      "ADL falling while price holds = stealth distribution",
    ],
    pitfalls: [
      "Cumulative absolute value is irrelevant — only slope and divergence with price matter",
      "Doji bars (close at midrange, CLV ≈ 0) contribute near-zero regardless of volume",
      "Range=0 bars (high=low) trendcraft impl assigns CLV=0 to avoid div-by-zero",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
  },
  {
    kind: "cvd",
    displayName: "Cumulative Volume Delta",
    category: "volume",
    oneLiner: "Cumulative buying minus selling pressure approximated from OHLCV.",
    whenToUse: [
      "Order-flow context without true tick data",
      "Spotting absorption (price flat but CVD spikes)",
      "Divergence with price for reversal cues",
    ],
    signals: [
      "Price up + CVD up = healthy bullish flow",
      "Price up + CVD flat or down = bearish divergence (sellers absorbing)",
    ],
    pitfalls: [
      "Approximation only — real CVD requires tick-level aggressor data (executed-at-bid vs executed-at-ask)",
      "trendcraft impl uses bar-position approximation: buyVolume = volume × (close-low) / (high-low). Does NOT drill down into lower-timeframe bars",
      "Cumulative scale not directly comparable across instruments",
      "Bars with high=low (no range) fall back gracefully but contribute zero delta",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
  },
  {
    kind: "twap",
    displayName: "Time-Weighted Average Price",
    category: "volume",
    oneLiner:
      "Equal-weighted average of typical prices over a session — execution benchmark that ignores volume.",
    whenToUse: [
      "Simple, predictable execution benchmark that doesn't adapt to volume distribution",
      "Slicing large orders evenly through the session to minimize market impact",
      "Mean-reversion reference when intraday volume distribution is unreliable",
    ],
    signals: [
      "Price above TWAP = intraday strength relative to time-equal benchmark",
      "Price below TWAP = intraday weakness",
    ],
    pitfalls: [
      "Ignores volume entirely — in illiquid markets TWAP can produce suboptimal fills since it doesn't adapt to liquidity",
      "TWAP and VWAP can diverge meaningfully on event days when volume is concentrated",
      "Not a market-direction reference; primarily an execution benchmark",
      "Resets per session by default — meaningless on multi-day timeframes without anchoring",
    ],
    synergy: ["VWAP for cross-check; large TWAP-VWAP gap signals uneven volume distribution"],
    marketRegime: ["ranging"],
    timeframe: ["intraday"],
    paramHints: {
      sessionResetPeriod:
        "'session' default (resets per trading day). Pass a number for fixed N-bar reset",
    },
  },
  {
    kind: "elderForceIndex",
    displayName: "Elder's Force Index",
    category: "volume",
    oneLiner:
      "Alexander Elder's momentum × volume oscillator (Trading for a Living): EMA-smoothed (Close - PrevClose) × Volume.",
    whenToUse: [
      "Confirming trend strength with combined price/volume thrust",
      "Spotting bullish/bearish divergence between price and force",
      "Validating breakouts: strong breakout should show large positive Force Index",
    ],
    signals: [
      "Force Index > 0 sustained = bullish; < 0 sustained = bearish",
      "Bullish divergence (price LL, FI HL) = trend reversal cue",
      "Bearish divergence (price HH, FI LH) = trend exhaustion warning",
      "Zero-line crossover = momentum direction shift",
    ],
    pitfalls: [
      "Volume spike on a tiny price move yields a large Force value — can mislead",
      "Default 13 EMA smoothes substantial intra-period variation; raw 1-period FI is very noisy",
      "Elder explicitly prescribes BOTH a short-period (2) FI for entries AND long-period (13) for trend; trendcraft's single-period default tilts to the long",
    ],
    synergy: [
      "Pair with a separate short-period Force Index (period=2) for entries vs long-period (13) for trend (Elder's canonical setup)",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing"],
    paramHints: {
      period:
        "13 default EMA smoothing (Elder's long-period). Use period=2 for short-period entry signals",
    },
  },
  {
    kind: "easeOfMovement",
    displayName: "Ease of Movement",
    category: "volume",
    oneLiner:
      "Richard Arms' volume-based oscillator measuring how easily price moves: midpoint shift divided by a volume-vs-range box ratio.",
    whenToUse: [
      "Detecting low-volume price moves (high EMV — easy advance)",
      "Detecting effort-vs-result mismatches (high volume + small move = low EMV)",
      "Cross-confirmation with VSA / Wyckoff effort-vs-result frameworks",
    ],
    signals: [
      "EMV > 0 = price advancing with relative ease (less volume needed per move)",
      "EMV < 0 = price declining with relative ease",
      "Zero-line crossovers = ease shifts (often after exhaustion)",
    ],
    pitfalls: [
      "Range-zero bars (high=low) make the box ratio explode — trendcraft handles with fallback",
      "trendcraft uses `volumeDivisor=10000` by default; canonical Arms formula uses 100,000,000. Magnitudes differ — focus on sign and slope, not absolute values",
      "Useless on instruments with unreliable volume",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing"],
    paramHints: {
      period: "14 default SMA smoothing",
      volumeDivisor:
        "10000 default in trendcraft (NOT the canonical 100,000,000) — keeps values readable but values are not directly comparable to ChartSchool examples",
    },
  },
  {
    kind: "klinger",
    displayName: "Klinger Volume Oscillator",
    category: "volume",
    oneLiner:
      "Stephen Klinger's volume-force oscillator combining short and long EMA differences with a signal line; common platform defaults 34/55/13 (Fibonacci numbers).",
    whenToUse: [
      "Long-term money flow trend identification while remaining sensitive to short-term reversals",
      "Divergence detection between volume force and price",
      "Signal-line crossover systems",
    ],
    signals: [
      "KVO crosses above signal = bullish entry cue",
      "KVO crosses below signal = bearish entry cue",
      "KVO > 0 = bullish bias; KVO < 0 = bearish bias",
      "Divergence between KVO and price = trend exhaustion",
    ],
    pitfalls: [
      "Volume Force formula is intricate (trend continuation tracking) — debugging anomalies requires understanding the cm/dm accumulator",
      "Fibonacci 34/55/13 defaults are heuristic, not derived from optimization",
      "Long warmup: needs `longPeriod` (55) bars at minimum",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      shortPeriod: "34 default — common platform setting (Fibonacci number)",
      longPeriod: "55 default — common platform setting (Fibonacci number)",
      signalPeriod: "13 default — common platform setting (Fibonacci number) for signal line EMA",
    },
  },
  {
    kind: "pvt",
    displayName: "Price Volume Trend",
    category: "volume",
    oneLiner:
      "OBV-style cumulative line that weights volume by percent price change instead of all-or-nothing.",
    whenToUse: [
      "More nuanced volume confirmation than OBV (proportional to move size)",
      "Divergence detection between price and cumulative volume flow",
      "Long-term accumulation/distribution analysis",
    ],
    signals: [
      "Rising PVT = uptrend confirmed by proportional volume",
      "Falling PVT = downtrend confirmed",
      "Bullish divergence (price LL, PVT HL) = potential reversal up",
      "Bearish divergence (price HH, PVT LH) = potential reversal down",
    ],
    pitfalls: [
      "Cumulative absolute value is meaningless — only slope and divergence matter",
      "Sensitive to extremely small percent changes magnifying volume contribution near support",
      "Requires reliable volume data; useless on instruments where volume is unreliable",
    ],
    synergy: [
      "OBV for cross-check; OBV is unweighted, PVT is percent-weighted — disagreement reveals which moves were proportional",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
  },
  {
    kind: "nvi",
    displayName: "Negative Volume Index",
    category: "volume",
    oneLiner:
      "Tracks price changes only on quiet-volume days. Originally developed by Paul Dysart in the 1930s; Norman Fosback's 1976 'Stock Market Logic' added the modern price-change formula and the 255-day EMA rule.",
    whenToUse: [
      "Long-term primary trend identification using Fosback's NVI > 255-day EMA rule",
      "'Smart money' tracking — assumes informed traders dominate quiet sessions",
    ],
    signals: [
      "NVI above its 255-day EMA = ~96% historical odds of a bull market (Fosback's empirical rule)",
      "NVI below its 255-day EMA = ~53% odds of a bear market (asymmetric — bull bias of stock market over time)",
      "Steady upward NVI on declining-volume days = stealth accumulation",
    ],
    pitfalls: [
      "Fosback's 96% bull-market figure is HISTORICAL across US equities — does not generalize to all markets/regimes",
      "Cumulative scale is arbitrary (depends on initial value, default 1000) — only direction vs MA matters",
      "Indicator stays unchanged on rising-volume days, so it is silent during many active trading sessions",
    ],
    synergy: ["255-day EMA of NVI itself is the canonical companion (Fosback's signal line)"],
    marketRegime: ["trending"],
    timeframe: ["position"],
    paramHints: {
      initialValue: "1000 default — arbitrary starting value (only changes vs MA matter)",
    },
  },
  {
    kind: "weisWave",
    displayName: "Weis Wave Volume",
    category: "volume",
    oneLiner:
      "David Weis's accumulator of volume within directional price waves — Wyckoff Effort-vs-Result tool.",
    whenToUse: [
      "Wyckoff effort-vs-result analysis (volume = effort, price progress = result)",
      "Identifying accumulation/distribution zones via wave-volume shifts",
      "Spotting capitulation: huge wave volume + small price progress = effort wasted",
    ],
    signals: [
      "Up wave with growing volume + progressing price = healthy uptrend",
      "Up wave with growing volume but stalled price = effort wasted, potential top",
      "Down wave with growing volume but stalled decline = absorption, potential bottom",
      "Direction flips when price reverses (close-based or high/low-based per `method`)",
    ],
    pitfalls: [
      "Wave detection depends on `method` (close vs highlow) and `threshold` — different settings produce different waves",
      "Manual Wyckoff analysis adds context that automated wave detection misses",
      "Less canonical than OBV/CMF; sparse reference data for cross-validation",
    ],
    synergy: [
      "VSA (Volume Spread Analysis) for bar-level effort-vs-result confirmation",
      "Wyckoff Phase Detection for higher-level context",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      method: "'close' default — reverse on close direction. 'highlow' uses high/low for direction",
      threshold: "0 default — minimum price change to trigger a new wave (filters tiny reversals)",
    },
  },
  {
    kind: "volumeAnomaly",
    displayName: "Volume Anomaly Detection",
    category: "volume",
    oneLiner:
      "Detects abnormal volume spikes via ratio-vs-average and Z-score, classifying as 'high' or 'extreme'.",
    whenToUse: [
      "Capitulation/breakout detection where institutional activity is suspected",
      "Filter for trade entries — confirm signals only when volume confirms the move",
      "Post-news / earnings monitoring",
    ],
    signals: [
      "level === 'high' (>= 2× average OR z-score >= 2.0) = notable spike",
      "level === 'extreme' (>= 3× average OR z-score >= 1.5× threshold) = significant event, likely heightened participation / event-driven activity",
      "Combine with price action: extreme volume on a breakout = strong; on a doji = potential exhaustion",
    ],
    pitfalls: [
      "Detection thresholds are heuristic — recalibrate per instrument (different baselines for stocks vs crypto)",
      "20-bar baseline is short — major events span multiple bars and may distort future baselines",
      "Doesn't tell you direction — combine with price/CVD/CMF for context",
    ],
    marketRegime: ["volatile"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "20 default — moving-average baseline window",
      highThreshold: "2.0 default — ratio multiplier for 'high' level",
      extremeThreshold: "3.0 default — ratio multiplier for 'extreme' level",
      useZScore: "true default — also flag based on Z-score of volume",
      zScoreThreshold: "2.0 default — Z-score (≈2 sigma) threshold",
    },
  },
  {
    kind: "volumeTrend",
    displayName: "Volume Trend Confirmation",
    category: "volume",
    oneLiner:
      "Composite analysis of whether volume confirms or diverges from the current price trend.",
    whenToUse: [
      "Filtering trade entries to require volume confirmation",
      "Detecting trend exhaustion via price-volume divergence",
      "Risk management: scaling out when volume stops confirming",
    ],
    signals: [
      "isConfirmed === true && priceTrend === 'up' = healthy uptrend (price + volume both rising)",
      "isConfirmed === true && priceTrend === 'down' = strong selling (price falling + volume rising)",
      "hasDivergence === true && priceTrend === 'down' = bullish divergence (selling exhaustion)",
      "hasDivergence === true && priceTrend === 'up' = bearish divergence (weak rally)",
    ],
    pitfalls: [
      "Trend determination requires `minPriceChange` threshold (default 2%) — sub-threshold moves are tagged 'sideways'",
      "Both price and volume trends use simple slope direction — sophisticated trend definitions may differ",
      "trendcraft-specific composite indicator; reference values are not standardized across platforms",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
    paramHints: {
      pricePeriod: "10 default — price-trend window",
      volumePeriod: "10 default — volume-trend window",
      maPeriod: "20 default — volume MA baseline",
      minPriceChange: "2.0 default — minimum % price change to register as a trend",
    },
  },
  {
    kind: "volumeMa",
    displayName: "Volume Moving Average",
    category: "volume",
    oneLiner: "SMA or EMA of volume — baseline for spike detection and volume trend analysis.",
    whenToUse: [
      "Volume baseline for breakout confirmation (current vs 20-period MA)",
      "Building block for custom volume oscillators and anomaly detectors",
      "Visual reference for 'normal' volume on a chart",
    ],
    signals: [
      "Current volume > 1.5-2× volumeMa = elevated activity",
      "Current volume sustained < volumeMa during a price move = weak conviction",
    ],
    pitfalls: [
      "Volume series can be highly skewed (long tail) — SMA on raw volume is sensitive to single huge bars",
      "EMA mode adapts faster but can mask gradual structural shifts in baseline volume",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "Required (no default). Common: 20 for spike detection, 50 for medium-term baseline",
      type: "'sma' default. 'ema' for faster response to recent volume",
    },
  },
  {
    kind: "cvdWithSignal",
    displayName: "CVD with Signal Line",
    category: "volume",
    oneLiner:
      "Cumulative Volume Delta (bar-position approximation) plus an EMA signal line for crossover-based timing.",
    whenToUse: [
      "Order-flow-style entries via CVD/signal crossovers",
      "Smoothing CVD to filter noise while preserving directional bias",
      "Layering CVD on price chart for accumulation/distribution divergences",
    ],
    signals: [
      "CVD crosses above signal = bullish flow shift",
      "CVD crosses below signal = bearish flow shift",
      "CVD divergence with price (price up, CVD down) = bearish divergence (sellers absorbing)",
    ],
    pitfalls: [
      "Inherits all CVD limitations — bar-position approximation, NOT true tick-aggressor data",
      "Signal-line crossovers can lag in fast markets",
      "Smoothing CVD itself (`smoothing` > 1) further dampens signal speed",
    ],
    synergy: ["Plain CVD for raw flow inspection; this composition adds trigger timing"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      smoothing:
        "1 default (no extra smoothing of CVD). Set >1 to apply EMA to CVD itself before computing the signal",
      signalPeriod: "9 default — EMA period for the signal line over CVD",
    },
  },
];
