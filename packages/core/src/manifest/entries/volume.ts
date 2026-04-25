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
      "Resets daily — meaningless on multi-day timeframes",
      "Less useful pre-market or in low-volume sessions",
    ],
    synergy: ["VWAP bands (stddev-scaled) for overshoot/undershoot detection"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday"],
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
    pitfalls: ["Anchor choice is subjective — bad anchors give meaningless levels"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
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
      "Treats every up-day equally regardless of close magnitude",
      "Cumulative absolute value is meaningless — only changes/divergences matter",
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
    ],
    pitfalls: [
      "Same as RSI — gets stuck in extremes during strong trends",
      "Useless on instruments with unreliable volume",
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
    oneLiner: "Volume-weighted accumulation/distribution oscillator (-1 to +1).",
    whenToUse: ["Detecting buying vs selling pressure", "Confirming trend with money flow"],
    signals: [
      "CMF > 0 sustained = accumulation",
      "CMF < 0 sustained = distribution",
      "Divergence with price = trend weakness",
    ],
    pitfalls: ["Lagging — confirms but rarely leads", "Sensitive to closing range within bar"],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing"],
  },
  {
    kind: "adl",
    displayName: "Accumulation/Distribution Line",
    category: "volume",
    oneLiner: "Cumulative volume × close-location-value.",
    whenToUse: ["Long-term accumulation/distribution divergence with price"],
    signals: [
      "ADL rising while price flat = stealth accumulation",
      "ADL falling while price holds = stealth distribution",
    ],
    pitfalls: ["Cumulative value irrelevant — slope and divergence matter"],
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
      "Approximation only — real CVD needs tick-level bid/ask data",
      "Cumulative scale not directly comparable across instruments",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday", "swing"],
  },
];
