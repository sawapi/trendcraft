/**
 * Strategy Template — declarative strategy definition for LLM manipulation
 *
 * Templates are pure data (JSON-serializable). The compiler converts them
 * into executable StrategyDefinition objects. LLMs operate only on this layer.
 */

/**
 * Reference to a condition from the palette
 */
export type ConditionRef = {
  type: string;
  params?: Record<string, number | string>;
};

/**
 * Combined condition with logical operator
 */
export type CombinedCondition = {
  operator: "and" | "or";
  conditions: ConditionRef[];
};

/**
 * Entry or exit rule — single condition or combined
 */
export type ConditionRule = ConditionRef | CombinedCondition;

/**
 * Indicator reference in a template
 */
export type IndicatorRef = {
  type: string;
  name: string;
  params: Record<string, number>;
};

/**
 * Regime gate — blocks entries when market regime doesn't match.
 * Automatically injects a regime indicator and wraps entry conditions.
 */
export type RegimeGate = {
  /** Minimum ADX trend strength to allow entry (default: 20) */
  minTrendStrength?: number;
  /** Only allow entries in these trend directions */
  allowedTrends?: Array<"bullish" | "bearish" | "sideways">;
  /** Only allow entries in these volatility regimes */
  allowedVolatility?: Array<"low" | "normal" | "high">;
};

/**
 * Market filter — conditions on a benchmark symbol (e.g., SPY) that must be met
 * before the strategy is allowed to enter trades.
 * LLMs can set this per-strategy to control when a strategy is deployed.
 */
export type MarketFilter = {
  /** Benchmark symbol to monitor (default: "SPY") */
  symbol?: string;
  /** Only enter when benchmark daily change % is above this value (e.g., -0.3 = market down 0.3%+) */
  maxDailyChange?: number;
  /** Only enter when benchmark daily change % is below this value */
  minDailyChange?: number;
  /** Only enter when benchmark is in one of these trend states */
  allowedTrends?: Array<"bullish" | "bearish" | "sideways">;
  /** Only enter when benchmark volatility is in one of these regimes */
  allowedVolatility?: Array<"low" | "normal" | "high">;
};

/**
 * Declarative strategy template — LLM reads and writes this format
 */
export type StrategyTemplate = {
  id: string;
  name: string;
  description: string;
  intervalMs: number;
  symbols: string[];

  /** Position direction: "long" (default), "short", or "both" */
  direction?: "long" | "short" | "both";

  indicators: IndicatorRef[];
  entry: ConditionRule;
  exit: ConditionRule;

  guards: {
    maxDailyLoss: number;
    maxDailyTrades: number;
    timeGuard?: "market-hours" | null; // null = no time guard (swing)
  };
  /** Market-level filter — only allow entries when benchmark meets conditions */
  marketFilter?: MarketFilter;
  /** Regime gate — block entries when market regime doesn't match */
  regimeGate?: RegimeGate;
  /** Multi-timeframe indicators — higher TF confirmation for entry */
  mtfIndicators?: {
    timeframe: "5Min" | "15Min" | "1Hour" | "1Day";
    indicators: IndicatorRef[];
  }[];
  position: {
    capital: number;
    sizingMethod: "risk-based" | "fixed-fractional" | "full-capital" | "kelly";
    riskPercent?: number;
    stopLoss: number;
    takeProfit?: number;
    trailingStop?: number;
    atrTrailingStop?: { period: number; multiplier: number };
    partialTakeProfit?: { threshold: number; portion: number };
    breakEvenStop?: { triggerPercent: number; offset: number };
    slippage: number;
    /** Fixed per-trade commission ($) — defaults to DEFAULT_TRADING_COSTS */
    commission?: number;
    /** Proportional commission rate (%) — defaults to DEFAULT_TRADING_COSTS */
    commissionRate?: number;
    /** Tax rate on realized gains (%) — defaults to DEFAULT_TRADING_COSTS */
    taxRate?: number;
    /** Order type: "market" (default) or "limit" */
    orderType?: "market" | "limit";
    /** Limit price offset from signal price in percent (for limit orders) */
    limitOffsetPercent?: number;
  };

  signalLifecycle?: {
    cooldownBars?: number;
    debounceBars?: number;
    expiryBars?: number;
  };

  /** Preferred bar timeframe for backtesting (overrides intervalMs-based inference) */
  backtestTimeframe?: "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day";
  /** Preferred lookback period in days for backtesting */
  backtestPeriodDays?: number;

  source: "preset" | "llm-generated";
  parentId?: string;
  reasoning?: string;
};

/**
 * Parameter override — partial changes applied on top of a base template
 */
export type ParameterOverride = {
  strategyId: string;
  overrides: {
    indicators?: IndicatorRef[];
    position?: Partial<StrategyTemplate["position"]>;
    guards?: Partial<StrategyTemplate["guards"]>;
    marketFilter?: MarketFilter | null;
    regimeGate?: RegimeGate | null;
    mtfIndicators?: StrategyTemplate["mtfIndicators"];
    entry?: ConditionRule;
    exit?: ConditionRule;
    backtestTimeframe?: StrategyTemplate["backtestTimeframe"];
    backtestPeriodDays?: number;
  };
  appliedAt: number;
  reasoning: string;
};

/**
 * Helper to check if a condition rule is a combined condition
 */
export function isCombined(rule: ConditionRule): rule is CombinedCondition {
  return "operator" in rule;
}

/**
 * Preset templates for built-in strategies
 */
export const PRESET_TEMPLATES: StrategyTemplate[] = [
  {
    id: "rsi-mean-reversion",
    name: "RSI Mean Reversion",
    description: "Buy when RSI(14) < 30, sell when RSI(14) > 70",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [{ type: "rsi", name: "rsi", params: { period: 14 } }],
    entry: { type: "rsiBelow", params: { threshold: 30 } },
    exit: { type: "rsiAbove", params: { threshold: 70 } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 10 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 3,
      takeProfit: 6,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "macd-trend",
    name: "MACD Trend Following",
    description: "Enter on MACD bullish cross, exit on bearish cross with trailing stop",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      {
        type: "macd",
        name: "macd",
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      },
    ],
    entry: { type: "macdPositive" },
    exit: { type: "macdNegative" },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      trailingStop: 3,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "bollinger-squeeze",
    name: "Bollinger Squeeze",
    description: "Buy at lower Bollinger Band + RSI < 40, sell at upper band or RSI > 70",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "bollinger", name: "bb", params: { period: 20, stdDev: 2 } },
      { type: "rsi", name: "rsi", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelow", params: { indicatorKey: "bb.lower" } },
        { type: "rsiBelow", params: { threshold: 40 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "priceAbove", params: { indicatorKey: "bb.upper" } },
        { type: "rsiAbove", params: { threshold: 70 } },
      ],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 10 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      takeProfit: 5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "sma-golden-cross",
    name: "SMA Golden Cross",
    description:
      "Buy on SMA(20)/SMA(50) golden cross, sell on dead cross — mid-term trend following",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "sma", name: "sma20", params: { period: 20 } },
      { type: "sma", name: "sma50", params: { period: 50 } },
    ],
    entry: { type: "smaGoldenCross" },
    exit: { type: "smaDeadCross" },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 6 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 3,
      trailingStop: 4,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "dmi-trend",
    name: "DMI Trend",
    description: "Enter when ADX >= 25 and +DI > -DI (bullish), exit when bearish or ADX weakens",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "dmi", name: "dmi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: { type: "dmiBullish", params: { threshold: 25 } },
    exit: { type: "dmiBearish", params: { threshold: 20 } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 6 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      atrTrailingStop: { period: 14, multiplier: 2.5 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "rsi-ema-momentum",
    name: "RSI + EMA Momentum",
    description:
      "Buy pullbacks: price above EMA(50) + RSI < 50, exit on RSI > 65 or price below EMA(50)",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "ema", name: "ema50", params: { period: 50 } },
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceAbove", params: { indicatorKey: "ema50" } },
        { type: "rsiBelow", params: { threshold: 50 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "rsiAbove", params: { threshold: 65 } },
        { type: "priceBelow", params: { indicatorKey: "ema50" } },
      ],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 10 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      takeProfit: 5,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "bollinger-reversal",
    name: "Bollinger Reversal",
    description: "Buy at BB(20,2) lower band + Stochastics K < 20, exit at BB middle or Stoch > 80",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "bollinger", name: "bb", params: { period: 20, stdDev: 2 } },
      { type: "stochastics", name: "stoch", params: { kPeriod: 14, dPeriod: 3 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelow", params: { indicatorKey: "bb.lower" } },
        { type: "indicatorBelow", params: { indicatorKey: "stoch", threshold: 20 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "priceAbove", params: { indicatorKey: "bb.middle" } },
        { type: "indicatorAbove", params: { indicatorKey: "stoch", threshold: 80 } },
      ],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 12 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 2,
      takeProfit: 4,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  {
    id: "ema-crossover-trend",
    name: "EMA Crossover Trend",
    description:
      "Buy when price above SMA(50) filter + EMA(9), exit below EMA(21) — fast trend capture",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "ema", name: "ema9", params: { period: 9 } },
      { type: "ema", name: "ema21", params: { period: 21 } },
      { type: "sma", name: "sma50", params: { period: 50 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceAbove", params: { indicatorKey: "sma50" } },
        { type: "priceAbove", params: { indicatorKey: "ema9" } },
      ],
    },
    exit: { type: "priceBelow", params: { indicatorKey: "ema21" } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 10 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 1.5,
      trailingStop: 2.5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  // --- Swing strategies (no time guard, daily/hourly intervals) ---
  {
    id: "ema-swing-daily",
    name: "EMA Crossover Swing (Daily)",
    description: "Daily EMA(10)/EMA(30) crossover swing trade — no intraday time guard",
    intervalMs: 86_400_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT"],
    indicators: [
      { type: "ema", name: "ema10", params: { period: 10 } },
      { type: "ema", name: "ema30", params: { period: 30 } },
    ],
    entry: { type: "emaGoldenCross" },
    exit: { type: "emaDeadCross" },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 4, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 5,
      trailingStop: 6,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 2 },
    backtestTimeframe: "1Day",
    backtestPeriodDays: 180,
    source: "preset",
  },
  {
    id: "rsi-swing-daily",
    name: "RSI Swing (Daily)",
    description: "Daily RSI < 35 + price > EMA(50) entry, RSI > 65 exit — swing trade",
    intervalMs: 86_400_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT"],
    indicators: [
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "ema", name: "ema50", params: { period: 50 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "rsiBelow", params: { threshold: 35 } },
        { type: "priceAbove", params: { indicatorKey: "ema50" } },
      ],
    },
    exit: { type: "rsiAbove", params: { threshold: 65 } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 4, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 5,
      takeProfit: 10,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Day",
    backtestPeriodDays: 180,
    source: "preset",
  },
  {
    id: "bollinger-swing-hourly",
    name: "Bollinger + ADX Trend (Hourly)",
    description: "Hourly BB(20,2) lower band + ADX > 25 entry, BB upper band exit — swing trade",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT"],
    indicators: [
      { type: "bollinger", name: "bb", params: { period: 20, stdDev: 2 } },
      { type: "dmi", name: "dmi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelow", params: { indicatorKey: "bb.lower" } },
        { type: "dmiBullish", params: { threshold: 25 } },
      ],
    },
    exit: { type: "priceAbove", params: { indicatorKey: "bb.upper" } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 6, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.75,
      stopLoss: 4,
      atrTrailingStop: { period: 14, multiplier: 2.5 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
  },
  {
    id: "macd-adx-filter",
    name: "MACD + ADX Filter",
    description:
      "MACD bullish cross filtered by ADX >= 20 to confirm trend strength, exit on bearish cross",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      {
        type: "macd",
        name: "macd",
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      },
      { type: "dmi", name: "dmi", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [{ type: "macdPositive" }, { type: "dmiBullish", params: { threshold: 20 } }],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "macdNegative" }, { type: "dmiBearish", params: { threshold: 20 } }],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      trailingStop: 3.5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
  },
  // --- New day-trading / short-term swing strategies ---
  {
    id: "vwap-mean-reversion",
    name: "VWAP Mean Reversion",
    description: "Buy when price < VWAP + RSI < 35 + price > EMA(50) — institutional bounce play",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "vwap", name: "vwap", params: {} },
      { type: "rsi", name: "rsi", params: { period: 10 } },
      { type: "ema", name: "ema50", params: { period: 50 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelowVwap" },
        { type: "rsiBelow", params: { threshold: 35 } },
        { type: "priceAbove", params: { indicatorKey: "ema50" } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "priceAboveVwap" }, { type: "rsiAbove", params: { threshold: 65 } }],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      takeProfit: 4,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "VWAP is the institutional average cost level. " +
      "Buying below VWAP with RSI confirmation targets oversold bounces in an uptrend.",
  },
  {
    id: "keltner-reversion",
    name: "Keltner Channel Mean Reversion",
    description:
      "Buy at Keltner lower band + RSI < 30, exit at middle band — ATR-based mean reversion",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "keltner", name: "keltner", params: { period: 20, multiplier: 2 } },
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelowKeltnerLower" },
        { type: "rsiBelow", params: { threshold: 30 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "priceAboveKeltnerMiddle" },
        { type: "rsiAbove", params: { threshold: 70 } },
      ],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 3,
      takeProfit: 6,
      atrTrailingStop: { period: 14, multiplier: 1.5 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "Keltner uses ATR instead of stddev, making bands more robust to outliers. " +
      "77% win rate reported on S&P500 (QuantifiedStrategies.com).",
  },
  {
    id: "ema-vwap-momentum",
    name: "EMA Cross + VWAP Momentum",
    description:
      "EMA(8)/EMA(21) bullish cross + price > VWAP + RSI > 50 — triple-confirmation momentum",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "ema", name: "ema8", params: { period: 8 } },
      { type: "ema", name: "ema21", params: { period: 21 } },
      { type: "vwap", name: "vwap", params: {} },
      { type: "rsi", name: "rsi", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "emaCrossUp" },
        { type: "priceAboveVwap" },
        { type: "rsiAbove", params: { threshold: 50 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "emaCrossDown" }, { type: "priceBelowVwap" }],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8, timeGuard: null },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 1.5,
      takeProfit: 3,
      trailingStop: 2,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "Triple confirmation: trend (EMA cross) + volume (VWAP) + momentum (RSI). " +
      "Non-correlated indicators reduce false signals.",
  },
  {
    id: "stoch-momentum-swing",
    name: "Stochastic Momentum Swing",
    description:
      "Stochastic K/D oversold cross + price > EMA(50) — reversal from oversold in uptrend",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "stochastics", name: "stoch", params: { kPeriod: 14, dPeriod: 3 } },
      { type: "ema", name: "ema50", params: { period: 50 } },
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "stochOversoldCrossUp", params: { threshold: 20 } },
        { type: "priceAbove", params: { indicatorKey: "ema50" } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "stochOverbought", params: { threshold: 80 } },
        { type: "rsiAbove", params: { threshold: 70 } },
      ],
    },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      takeProfit: 4,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "Stochastic oversold crossup targets reversals from exhaustion points. " +
      "EMA(50) filter ensures we only buy dips in an established uptrend.",
  },
  // --- Multi-timeframe (MTF) strategies ---
  {
    id: "ema-cross-htf-filter",
    name: "EMA Cross + HTF Filter",
    description: "1min EMA(9)/EMA(21) cross + 15min EMA(50) trend filter — higher TF confirmation",
    intervalMs: 60_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "ema", name: "ema9", params: { period: 9 } },
      { type: "ema", name: "ema21", params: { period: 21 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    mtfIndicators: [
      {
        timeframe: "15Min",
        indicators: [{ type: "ema", name: "ema50", params: { period: 50 } }],
      },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "emaCrossUp" },
        { type: "mtfPriceAbove", params: { indicatorKey: "ema50", timeframe: "15m" } },
      ],
    },
    exit: { type: "emaCrossDown" },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 8 },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 1.5,
      takeProfit: 3,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
    reasoning:
      "Higher timeframe trend filter reduces false signals. " +
      "Only trade EMA crosses when 15min EMA(50) confirms the trend direction.",
  },
  // --- Short selling strategies ---
  {
    id: "rsi-overbought-short",
    name: "RSI Overbought Short",
    description: "Short when RSI > 70 + price below EMA(50), cover when RSI < 30",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    direction: "short",
    indicators: [
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "ema", name: "ema50", params: { period: 50 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "rsiAbove", params: { threshold: 70 } },
        { type: "priceBelow", params: { indicatorKey: "ema50" } },
      ],
    },
    exit: { type: "rsiBelow", params: { threshold: 30 } },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 6, timeGuard: null },
    regimeGate: { allowedTrends: ["bearish", "sideways"] },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 3,
      takeProfit: 6,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning: "Short overbought RSI below a declining EMA(50) — bearish trend exhaustion short.",
  },
  {
    id: "ema-dead-cross-short",
    name: "EMA Dead Cross Short",
    description: "Short on EMA(10)/EMA(30) dead cross, cover on golden cross",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    direction: "short",
    indicators: [
      { type: "ema", name: "ema10", params: { period: 10 } },
      { type: "ema", name: "ema30", params: { period: 30 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: { type: "emaDeadCross" },
    exit: { type: "emaGoldenCross" },
    guards: { maxDailyLoss: -5_000, maxDailyTrades: 4, timeGuard: null },
    regimeGate: { minTrendStrength: 20 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 4,
      trailingStop: 5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "EMA dead cross is a classic bearish signal. " +
      "Regime gate ensures we only short in confirmed downtrends.",
  },
  // --- SMC (Smart Money Concepts) strategies ---
  {
    id: "smc-ob-bounce",
    name: "SMC Order Block Bounce",
    description: "Buy at bullish Order Block zone + RSI < 40 — institutional support bounce",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [{ type: "priceAtBullishOB" }, { type: "rsiBelow", params: { threshold: 40 } }],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "rsiAbove", params: { threshold: 70 } }],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 6, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      takeProfit: 4,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "Order blocks mark zones where institutional traders placed orders. " +
      "Bullish OB + oversold RSI = high-probability reversal zone.",
  },
  {
    id: "smc-sweep-reversal",
    name: "SMC Sweep Reversal",
    description: "Buy on recovered bullish liquidity sweep + RSI < 45 — smart money reversal",
    intervalMs: 3_600_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "liquiditySweepRecovered", params: { type: "bullish" } },
        { type: "rsiBelow", params: { threshold: 45 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "rsiAbove", params: { threshold: 65 } }],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 6, timeGuard: null },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      takeProfit: 5,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "1Hour",
    backtestPeriodDays: 90,
    source: "preset",
    reasoning:
      "Liquidity sweeps below swing lows trap retail stops. " +
      "Recovery after sweep signals institutional accumulation.",
  },
  // --- VWAP Band and Gap strategies ---
  {
    id: "vwap-band-reversion",
    name: "VWAP Band Reversion",
    description:
      "Buy at VWAP lower band (−1σ) + RSI < 35, sell at VWAP — institutional mean reversion",
    intervalMs: 60_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "vwap", name: "vwap", params: {} },
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelowVwapLowerBand" },
        { type: "rsiBelow", params: { threshold: 35 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "priceAboveVwap" }, { type: "rsiAbove", params: { threshold: 65 } }],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 10 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 1.5,
      takeProfit: 3,
      atrTrailingStop: { period: 14, multiplier: 1.5 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 5,
    source: "preset",
    reasoning:
      "VWAP lower band represents institutional oversold. " +
      "Mean reversion to VWAP with RSI confirmation for high-probability bounces.",
  },
  {
    id: "gap-fade",
    name: "Gap Fade",
    description: "Buy gap-down reversals: open > -1% below prev close + RSI < 30 — fade the gap",
    intervalMs: 60_000,
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    indicators: [
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "ema", name: "ema50", params: { period: 50 } },
      { type: "atr", name: "atr", params: { period: 14 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "gapDown", params: { minGapPercent: 1 } },
        { type: "rsiBelow", params: { threshold: 30 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [{ type: "rsiAbove", params: { threshold: 60 } }],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 4 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      takeProfit: 3,
      atrTrailingStop: { period: 14, multiplier: 2 },
      slippage: 0.1,
    },
    signalLifecycle: { cooldownBars: 10 },
    backtestTimeframe: "5Min",
    backtestPeriodDays: 10,
    source: "preset",
    reasoning:
      "Gap downs often reverse intraday, especially on large caps. " +
      "RSI < 30 confirms oversold before fading the gap.",
  },
];

/**
 * Check if a strategy definition is a swing strategy (no time guard)
 */
export function isSwingStrategy(strategy: { guards?: { timeGuard?: unknown } }): boolean {
  return !strategy.guards?.timeGuard;
}

/**
 * Get a preset template by ID
 */
export function getPresetTemplate(id: string): StrategyTemplate | undefined {
  return PRESET_TEMPLATES.find((t) => t.id === id);
}

/**
 * Apply parameter overrides to a template, returning a new template
 */
export function applyOverrides(
  base: StrategyTemplate,
  override: ParameterOverride,
): StrategyTemplate {
  const result = { ...base };

  if (override.overrides.indicators) {
    result.indicators = override.overrides.indicators;
  }
  if (override.overrides.position) {
    result.position = { ...result.position, ...override.overrides.position };
  }
  if (override.overrides.guards) {
    result.guards = { ...result.guards, ...override.overrides.guards };
  }
  if (override.overrides.marketFilter !== undefined) {
    // null clears the filter, MarketFilter object sets it
    result.marketFilter = override.overrides.marketFilter ?? undefined;
  }
  if (override.overrides.regimeGate !== undefined) {
    result.regimeGate = override.overrides.regimeGate ?? undefined;
  }
  if (override.overrides.entry) {
    result.entry = override.overrides.entry;
  }
  if (override.overrides.exit) {
    result.exit = override.overrides.exit;
  }
  if (override.overrides.backtestTimeframe) {
    result.backtestTimeframe = override.overrides.backtestTimeframe;
  }
  if (override.overrides.backtestPeriodDays) {
    result.backtestPeriodDays = override.overrides.backtestPeriodDays;
  }

  return result;
}
