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
  };

  signalLifecycle?: {
    cooldownBars?: number;
    debounceBars?: number;
    expiryBars?: number;
  };

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
    entry?: ConditionRule;
    exit?: ConditionRule;
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
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2,
      trailingStop: 3,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
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
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 3,
      trailingStop: 4,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
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
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      atrTrailingStop: { period: 14, multiplier: 2.5 },
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
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
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 1.5,
      trailingStop: 2.5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 3 },
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
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 2.5,
      trailingStop: 3.5,
      slippage: 0.05,
    },
    signalLifecycle: { cooldownBars: 5 },
    source: "preset",
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
  if (override.overrides.entry) {
    result.entry = override.overrides.entry;
  }
  if (override.overrides.exit) {
    result.exit = override.overrides.exit;
  }

  return result;
}
