import type { IndicatorManifest } from "../types";

export const SPECIALIZED_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "vsa",
    displayName: "Volume Spread Analysis (VSA)",
    category: "wyckoff",
    oneLiner:
      "Bar-by-bar classification combining volume, spread (range vs ATR), and close position; modern Wyckoff Effort-vs-Result formalization popularized by Tom Williams (TradeGuider, late 20th century).",
    whenToUse: [
      "Wyckoff-style discretionary trading where each bar's character matters",
      "Detecting smart-money vs retail activity via effort-result mismatches",
      "Spotting climactic action, springs, and upthrusts at structure points",
    ],
    signals: [
      "noSupply / noDemand: low-volume narrow-spread bars suggesting professional disinterest",
      "stoppingVolume: high volume + close in lower third of bar = supply being absorbed (often near lows)",
      "climacticAction: extreme volume + wide spread = capitulation or blow-off",
      "spring: false break below a swing low followed by recovery (Wyckoff signature) — trendcraft impl uses bar-shape rules, NOT a strict low-volume requirement",
      "upthrust: false break above a swing high followed by rejection — trendcraft impl uses bar-shape rules, NOT a strict low-volume requirement",
      "test: low-volume retest of prior high/low = confirmation of strength",
      "effortDivergence: high volume (effort) without commensurate price progress (result) = absorption",
    ],
    pitfalls: [
      "VSA is interpretive — automated bar classification gives a label, but Wyckoff context is needed for trading decisions",
      "11 bar types in trendcraft impl: noSupply, noDemand, stoppingVolume, climacticAction, test, upthrust, spring, absorption, effortUp, effortDown, normal",
      "Thresholds (`highVolumeThreshold=1.5`, `wideSpreadThreshold=1.2`, etc.) are heuristic — tune per instrument",
      "Useless on instruments with unreliable volume",
      "Single-bar classification ignores multi-bar context (Wyckoff phases, market structure) which matters more",
    ],
    synergy: [
      "Wyckoff Phase Detection for higher-level context",
      "Weis Wave for accumulated effort across waves",
    ],
    marketRegime: ["trending", "ranging", "volatile"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      volumeMaPeriod: "20 default — moving-average baseline for relative volume",
      atrPeriod: "14 default — ATR baseline for spread normalization",
      highVolumeThreshold: "1.5 default — multiple of average for 'high' volume",
      lowVolumeThreshold: "0.7 default — multiple of average for 'low' volume",
      wideSpreadThreshold: "1.2 default — multiple of ATR for 'wide' spread",
      narrowSpreadThreshold: "0.7 default — multiple of ATR for 'narrow' spread",
    },
  },
  {
    kind: "orderBlock",
    displayName: "Order Block",
    category: "smc",
    oneLiner:
      "ICT/SMC concept: the last opposing candle before an impulsive move that breaks structure (BOS) — institutional order zone often retested.",
    whenToUse: [
      "Smart Money Concepts (SMC) / ICT trading methodology",
      "Identifying institutional accumulation/distribution zones",
      "Entries on retest of unmitigated order blocks",
    ],
    signals: [
      "Bullish OB: last bearish candle before a bullish BOS — acts as support on retest",
      "Bearish OB: last bullish candle before a bearish BOS — acts as resistance on retest",
      "atBullishOB === true: price currently inside an active bullish OB zone",
      "atBearishOB === true: price currently inside an active bearish OB zone",
      "mitigated === true: price returned to and traded back through the OB",
    ],
    pitfalls: [
      "ICT/SMC is community-defined — definitions of 'order block' vary by source",
      "Many ICT traders require DISPLACEMENT (impulsive ATR-multiple move that breaks structure) for OB validity — trendcraft's `displacementAtr` parameter gates this; default 0 disables the filter",
      "trendcraft default mitigation = close-through the OB zone (`partialMitigation=false`). Set `partialMitigation=true` to use the touch-interpretation (price wicks into the OB)",
      "Many supposed 'order blocks' don't precede true displacement — strength score helps filter",
    ],
    synergy: [
      "Fair Value Gap (FVG) for confluence at the same retest level",
      "Liquidity Sweep before the BOS = stronger institutional setup",
      "Break of Structure (BOS) — the prerequisite move",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {},
  },
  {
    kind: "liquiditySweep",
    displayName: "Liquidity Sweep",
    category: "smc",
    oneLiner:
      "ICT/SMC concept: price briefly breaks a swing high/low (triggering stop orders) then quickly reverses — institutional liquidity-grab pattern.",
    whenToUse: [
      "Smart Money Concepts (SMC) / ICT trading methodology",
      "Detecting false breakouts at obvious S/R levels (where retail stops cluster)",
      "Confirming reversal setups via liquidity-grab + Market Structure Shift (MSS)",
    ],
    signals: [
      "Bullish sweep: price breaks below a swing low, then recovers above it = potential long",
      "Bearish sweep: price breaks above a swing high, then recovers below it = potential short",
      "recovered === true: confirmed sweep (price returned past the broken level on the same bar)",
      "sweepDepthPercent: how deeply the sweep went (size of the wick beyond the level)",
    ],
    pitfalls: [
      "Sweeps look identical to genuine breakouts in real-time — confirmation requires recovery",
      "trendcraft impl marks `recovered=true` when the bar that broke the level closes back past it. Multi-bar recoveries (sweep on bar N, recovery on bar N+1) need different logic",
      "Most 'sweeps' at minor swings are noise — focus on sweeps at major equal-highs/lows where stops cluster",
      "Combine with order-flow context: a sweep without follow-through reversal is just a trend continuation",
    ],
    synergy: [
      "Order Block + FVG entry levels after a confirmed sweep",
      "Market Structure Shift (MSS) / Break of Structure following the sweep = confluence",
      "ICT Kill Zones (London/NY open) where sweeps most often occur",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["intraday"],
    paramHints: {},
  },
  {
    kind: "hmmRegimes",
    displayName: "HMM Regime Detection",
    category: "regime",
    oneLiner:
      "Gaussian Hidden Markov Model with Baum-Welch fitting and Viterbi decoding; classifies bars into 'trending-up' / 'ranging' / 'trending-down' regimes.",
    whenToUse: [
      "Probabilistic regime classification for strategy gating",
      "Position sizing scaled by regime probability",
      "Regime-conditional backtests (run different strategies in each regime)",
      "Risk-on / risk-off detection on broad indices",
    ],
    signals: [
      "regime === 0,1,2 (or N) — discrete state assignment from Viterbi decoding",
      "label === 'trending-up' / 'ranging' / 'trending-down' (default 3-state human-readable labels)",
      "probabilities[]: full posterior over states — useful for soft-gating (e.g. only trade when P(trending) > 0.7)",
      "Expected duration metadata: stickiness of each regime (1 / (1 - self-transition prob))",
    ],
    pitfalls: [
      "Gaussian assumption per state may be violated during crashes/bubbles (fat tails)",
      "First-order Markov property: latent-state transitions depend only on the current hidden state — ignores longer-term context that often matters in finance",
      "Baum-Welch is non-convex: trendcraft uses 5 random restarts (numRestarts default) to mitigate local optima — final fit can still vary across runs",
      "State labels ('trending-up', etc.) are heuristic post-hoc assignments based on mean returns — actual state semantics depend on fit",
      "Long warmup: HMM needs enough data to fit reliably (typically 100+ bars per state)",
    ],
    synergy: [
      "Volatility Regime indicator for cross-confirmation of regime classification (ATR/BB-based)",
      "ChoppinessIndex for trend-vs-range orthogonal axis",
    ],
    marketRegime: ["trending", "ranging"],
    timeframe: ["swing", "position"],
    paramHints: {
      numStates:
        "3 default — typical for trending-up / ranging / trending-down. 2-state common for risk-on/off only",
      maxIterations: "100 default — Baum-Welch EM iterations cap",
      seed: "42 default — for reproducible random restarts",
      numRestarts: "5 default — random restarts to mitigate Baum-Welch local optima",
    },
  },
  {
    kind: "sessionBreakout",
    displayName: "Session Breakout",
    category: "session",
    oneLiner:
      "Tracks the most recently completed trading session's high/low and detects breakouts above/below that range on every subsequent bar (including bars inside a different active session).",
    whenToUse: [
      "ICT-style session-range breakout setups (e.g. London breaks Asian range)",
      "Day-trading session-transition strategies (Asian → London → NY)",
      "Confirming directional bias when one session breaks the prior session's range",
    ],
    signals: [
      "breakout === 'above': close above prior session's high — bullish breakout candidate",
      "breakout === 'below': close below prior session's low — bearish breakdown candidate",
      "fromSession: which prior session formed the broken range (e.g. 'asian', 'london')",
    ],
    pitfalls: [
      "Default uses ICT session definitions: Asia, London, NY AM, NY PM (4 sessions; NY is split into AM/PM in trendcraft) — non-FX instruments may need custom session windows",
      "Only tracks the MOST RECENT completed session — overlapping or chained breakouts (London breaks Asian, then NY breaks London) require checking session-by-session",
      "Breakout detection runs on every bar after a range exists, including bars inside a different active session — interpret in context",
      "Session boundaries depend on timezone — getTzHourMinute resolves; ensure candle timestamps are correct",
      "Failed breakouts (sweeps) common at session opens — combine with liquidity-sweep detection",
    ],
    synergy: [
      "Liquidity Sweep at session-range extremes = potential reversal setup vs continuation",
      "ICT Kill Zones for time-of-day filtering",
      "Opening Range Breakout (ORB) for the within-session variant",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday"],
    paramHints: {
      sessions:
        "Default = ICT sessions (Asia, London, NY AM, NY PM — 4 sessions, NY split). Pass custom SessionDefinition[] for other markets",
    },
  },
];
