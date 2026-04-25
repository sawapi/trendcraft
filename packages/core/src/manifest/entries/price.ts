import type { IndicatorManifest } from "../types";

export const PRICE_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "highestLowest",
    displayName: "Highest / Lowest",
    category: "price",
    oneLiner:
      "Rolling-window highest high and lowest low — the elemental support/resistance primitive.",
    whenToUse: [
      "Building block for breakout systems (Donchian, Turtle)",
      "Stop placement: use period-N low for stops on long positions",
      "Reference levels for visual chart annotation",
    ],
    signals: [
      "Close > previous N-period highest high = breakout above range",
      "Close < previous N-period lowest low = breakdown below range",
    ],
    pitfalls: [
      "Direction-agnostic primitive — only meaningful relative to current price",
      "Bare highest/lowest gives raw levels but no trend or strength info",
      "Sensitive to single outlier bars (one wick spike redefines the level)",
    ],
    synergy: ["Donchian Channel for the canonical envelope formulation around this primitive"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      period: "Required (no default). Common: 20 short-term, 55 swing (Turtle System 2)",
    },
  },
  {
    kind: "pivotPoints",
    displayName: "Pivot Points",
    category: "price",
    oneLiner:
      "Daily-pivot support/resistance levels; supports five calculation methods. trendcraft's `standard`/`fibonacci`/`camarilla` use prior H/L/C; `woodie`/`demark` also incorporate the current bar's open.",
    whenToUse: [
      "Intraday (1m, 5m, 15m) support/resistance reference for day traders",
      "Pre-market planning: levels are known before the session begins",
      "Quick context for entry/exit and stop placement around objective levels",
    ],
    signals: [
      "Price holding above pivot = bullish bias for the session",
      "Price holding below pivot = bearish bias",
      "R1/R2/R3 act as resistance on rallies; S1/S2/S3 as support on declines",
      "Method choice tunes the levels: standard (mainstream HLC), woodie (uses current open: (H+L+2*open)/4), camarilla (tight reversals by Nick Scott), demark (open/close emphasis), fibonacci (38.2/61.8 ratio levels)",
    ],
    pitfalls: [
      "Calculated from PREVIOUS session — first bar of new session must wait for prior bar",
      "Different methods produce materially different levels — don't compare across methods",
      "Levels are reference, not signals — confluence with other indicators improves quality",
      "Less useful on multi-day timeframes (pivots reset daily by definition)",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday"],
    paramHints: {
      method:
        "'standard' default. 'fibonacci' (38.2/61.8 ratios), 'woodie' (uses current bar open in pivot calc), 'camarilla' (tighter levels by Nick Scott), 'demark' (uses current bar open + prev close)",
    },
  },
  {
    kind: "fractals",
    displayName: "Bill Williams Fractals",
    category: "price",
    oneLiner:
      "5-bar fractal pattern: middle bar's high/low exceeds the surrounding 2 bars on each side.",
    whenToUse: [
      "Swing high/low confirmation in Bill Williams' broader trading system",
      "Building block for fractal-based breakout strategies",
      "Visual support/resistance markers",
    ],
    signals: [
      "Up fractal (swing high) = potential resistance level",
      "Down fractal (swing low) = potential support level",
      "Trade direction: enter long on close above an up fractal's high, short on close below a down fractal's low",
    ],
    pitfalls: [
      "CONFIRMATION lag: a fractal is identified `period` bars AFTER it forms (default 2 bars right). Not predictive — use as confirmation",
      "Most fractals are noise — Bill Williams pairs them with Alligator and AC for filtering",
      "Smaller `period` produces more frequent (and noisier) fractals; larger filters but increases lag",
    ],
    synergy: [
      "Alligator indicator (Bill Williams' broader system)",
      "Wait for fractal break (close above/below) rather than fractal formation alone",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period:
        "2 default — produces classic 5-bar fractal (2 left + middle + 2 right). Larger value = stricter filter",
    },
  },
  {
    kind: "gapAnalysis",
    displayName: "Gap Analysis",
    category: "price",
    oneLiner:
      "Detects price gaps between consecutive bars. Emits gap `type`, `classification` (full vs partial open-location), and a separate boolean `filled` for fill status.",
    whenToUse: [
      "Detecting opening gaps for gap-fill or gap-and-go strategies",
      "Confirming breakaway / runaway gap patterns from technical analysis",
      "Risk management: identifying unfilled gaps as future targets / S-R levels",
    ],
    signals: [
      "Gap up + open above prior high = potential breakaway/runaway gap",
      "Gap down + open below prior low = potential breakaway/runaway gap",
      "Filled === false on a long-standing gap = significant unfilled level (often S/R)",
      "Filled === true rapidly = exhaustion gap (failed move, often reversal)",
    ],
    pitfalls: [
      "trendcraft impl exposes TWO orthogonal fields: `classification` ('full' = open beyond prior H/L, 'partial' = open beyond close but inside H/L; canonical TA usually only uses 'full') AND a separate boolean `filled` for fill status",
      "Does NOT classify by trend context (breakaway / runaway / exhaustion / common / island) — that requires trend & volume context layered on top",
      "Default `minGapPercent=0.5` filters tiny gaps; tune per instrument volatility",
      "Cryptocurrency 24/7 markets rarely gap — indicator most useful on equities/futures with overnight breaks",
    ],
    synergy: ["Volume + trend context to classify gap type (breakaway vs exhaustion)"],
    marketRegime: ["volatile"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      minGapPercent: "0.5 default (%) — minimum gap size to register",
    },
  },
  {
    kind: "openingRange",
    displayName: "Opening Range Breakout (ORB)",
    category: "price",
    oneLiner:
      "Captures the first N minutes' high/low of a session and detects breakouts. trendcraft default reset is by CALENDAR DAY (not exchange-session-aligned).",
    whenToUse: [
      "Day trading: classic 9:30-10:00 ET (or 9:30-9:45) ORB strategy",
      "Identifying directional bias on intraday timeframes after the open",
      "Filtering trades to the dominant intraday direction",
    ],
    signals: [
      "Close above opening-range high = bullish breakout, long entry candidate",
      "Close below opening-range low = bearish breakout, short entry candidate",
      "Best ORB moves often resolve within 30-90 minutes of breakout",
    ],
    pitfalls: [
      "Failed breakouts (price briefly breaks then reverses) are common — wait for confirmation (close + volume)",
      "Range size matters: very tight opening range = high probability of false breakout (compression)",
      "30-minute default is one of several conventions — 15-minute and 60-minute also widely used; results differ materially",
      "Less useful in low-volatility sessions or on instruments without clear session boundaries",
    ],
    synergy: [
      "VWAP for institutional cost reference within the session",
      "Volume spike confirmation on the breakout bar",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday"],
    paramHints: {
      minutes: "30 default. Other common conventions: 5, 15, 60",
      sessionResetPeriod:
        "'day' default (CALENDAR-day reset, not exchange session). Pass a number for fixed N-bar reset",
    },
  },
  {
    kind: "fairValueGap",
    displayName: "Fair Value Gap",
    category: "price",
    oneLiner:
      "3-candle imbalance pattern where candle 1 and candle 3 wicks don't overlap — a price-imbalance zone often retested. Concept popularized in ICT/SMC trading communities.",
    whenToUse: [
      "Smart Money Concepts (SMC) / ICT trading methodology",
      "Identifying institutional imbalance zones for entries on retests",
      "Mean-reversion targets within trends (FVGs often act as magnets)",
    ],
    signals: [
      "Bullish FVG (uptrend): candle 3's low > candle 1's high → gap acts as support on retest",
      "Bearish FVG (downtrend): candle 3's high < candle 1's low → gap acts as resistance on retest",
      "Filled FVG = imbalance resolved; unfilled FVG = open target",
    ],
    pitfalls: [
      "ICT/SMC framework is community-defined, not academic — formal definitions vary by source",
      "Many 'FVGs' are noise on intraday timeframes — higher-timeframe FVGs are more meaningful",
      "Inverse FVG (IFVG): when an FVG fails and price slices through, the level can flip polarity — trendcraft does NOT track IFVG explicitly",
      "trendcraft tracks active and filled FVGs; cleanup when filled is automatic",
    ],
    synergy: [
      "Order Block (also SMC concept) for confluence",
      "Liquidity Sweep (SMC) for ICT-style entry timing",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {},
  },
  {
    kind: "swingPoints",
    displayName: "Swing Points",
    category: "price",
    oneLiner:
      "Confirmed swing highs/lows requiring N bars of confirmation on each side; emits price and bars-since metadata.",
    whenToUse: [
      "Building block for trend structure analysis (HH/HL = uptrend, LH/LL = downtrend)",
      "Pivot reference points for support/resistance, channel construction, Fibonacci levels",
      "Inputs to Break of Structure (BOS) and Change of Character (CHoCH) detection",
    ],
    signals: [
      "isSwingHigh === true = confirmed swing high (potential resistance)",
      "isSwingLow === true = confirmed swing low (potential support)",
      "swingHighPrice / swingLowPrice expose the most recent swing levels for downstream logic",
    ],
    pitfalls: [
      "CONFIRMATION lag: swing point identified `rightBars` bars AFTER it forms. Not real-time",
      "Larger leftBars/rightBars = stricter swings (fewer, more meaningful); smaller = noise-prone",
      "Default 5/5 is moderate strictness — Bill Williams' 2/2 is the looser fractal convention",
      "Test fixtures need enough bars: with leftBars=1, rightBars=1, need 7+ candles for 3 alternating swings",
    ],
    synergy: [
      "Bill Williams Fractals (same idea with looser default 2/2)",
      "Zigzag for connecting only 'significant' swings filtered by deviation",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {
      leftBars: "5 default — bars left of pivot required for confirmation",
      rightBars: "5 default — bars right of pivot required (= confirmation lag)",
    },
  },
  {
    kind: "zigzag",
    displayName: "Zigzag",
    category: "price",
    oneLiner:
      "Connects significant swing pivots filtered by minimum deviation (% or ATR-multiple); ignores moves below threshold.",
    whenToUse: [
      "Elliott Wave analysis — visualize impulse and corrective structure",
      "Filtering noise from swing-point detection: only meaningful turning points",
      "Pattern recognition: head-and-shoulders, double tops, etc. on cleaned swings",
    ],
    signals: [
      "Each new pivot = confirmed change of swing direction (after threshold met)",
      "ChangePercent metadata exposes the size of each completed swing",
    ],
    pitfalls: [
      "REPAINTS: the latest prospective/unconfirmed pivot can change as price evolves until reversal threshold is crossed — never use latest zigzag pivot for live entries",
      "Pure indicator — never tradeable in real time on the latest bar",
      "Default 5% deviation is a common heuristic; tune per instrument volatility",
      "ATR-mode requires ATR warmup; trendcraft uses percentage-based fallback during warmup and after `max(20, atrPeriod*2)` bars of flat action",
    ],
    synergy: [
      "Elliott Wave analysis tools",
      "Swing Points (zigzag is a filtered version of swing point detection)",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      deviation: "5 default (%) — minimum move size to confirm a new pivot",
      useAtr: "false default — pass true to use ATR-multiple threshold instead",
      atrPeriod: "14 default — only used when useAtr=true",
      atrMultiplier: "2 default — only used when useAtr=true",
    },
  },
  {
    kind: "heikinAshi",
    displayName: "Heikin-Ashi",
    category: "price",
    oneLiner:
      "Smoothed candlestick representation using averaged OHLC ('average bar' in Japanese); cleaner trend identification. Often attributed to 18th-century Japan but the modern formalization is 20th-century.",
    whenToUse: [
      "Trend identification on noisy charts (filters indecision candles)",
      "Trend-following systems where standard candles produce too many false reversals",
      "Visual confirmation of sustained trend direction",
    ],
    signals: [
      "Series of green HA candles with no lower wicks = strong uptrend (trend === 1)",
      "Series of red HA candles with no upper wicks = strong downtrend (trend === -1)",
      "Mixed candles with both wicks = indecision / consolidation (trend === 0)",
      "Color change after sustained run = potential trend reversal cue",
    ],
    pitfalls: [
      "HA prices are NOT actual market prices — never use HA values for entry/exit limits or backtests against real fills",
      "Smoothing introduces 1-bar lag relative to actual prices — late on sharp reversals",
      "Tendency to keep color longer makes 'time in trade' look better than reality on real-price charts",
      "Munehisa Homma attribution is folkloric — Heikin-Ashi as charted today is a 20th-century formalization",
    ],
    synergy: [
      "Standard candlesticks for actual price levels alongside HA for trend context",
      "ADX for trend-strength cross-confirmation when HA shows long color runs",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing", "position"],
    paramHints: {},
  },
];
