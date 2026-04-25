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
];
