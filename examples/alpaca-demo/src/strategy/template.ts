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
  };
  position: {
    capital: number;
    sizingMethod: "risk-based" | "fixed-fractional" | "full-capital";
    riskPercent?: number;
    stopLoss: number;
    takeProfit?: number;
    trailingStop?: number;
    slippage: number;
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
    source: "preset",
  },
  {
    id: "macd-trend",
    name: "MACD Trend Following",
    description:
      "Enter on MACD bullish cross, exit on bearish cross with trailing stop",
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
    source: "preset",
  },
  {
    id: "bollinger-squeeze",
    name: "Bollinger Squeeze",
    description:
      "Buy at lower Bollinger Band + RSI < 40, sell at upper band or RSI > 70",
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
    source: "preset",
  },
  {
    id: "vwap-bounce",
    name: "VWAP Bounce",
    description:
      "Buy dips below VWAP + RSI < 35, exit above VWAP + EMA(9) or RSI > 65",
    intervalMs: 60_000,
    symbols: ["AAPL", "SPY", "MSFT", "GOOGL", "AMZN"],
    indicators: [
      { type: "vwap", name: "vwap", params: {} },
      { type: "rsi", name: "rsi", params: { period: 14 } },
      { type: "ema", name: "ema9", params: { period: 9 } },
    ],
    entry: {
      operator: "and",
      conditions: [
        { type: "priceBelow", params: { indicatorKey: "vwap" } },
        { type: "rsiBelow", params: { threshold: 35 } },
      ],
    },
    exit: {
      operator: "or",
      conditions: [
        { type: "rsiAbove", params: { threshold: 65 } },
        { type: "priceAbove", params: { indicatorKey: "ema9" } },
      ],
    },
    guards: { maxDailyLoss: -3_000, maxDailyTrades: 12 },
    position: {
      capital: 100_000,
      sizingMethod: "risk-based",
      riskPercent: 0.5,
      stopLoss: 1.5,
      takeProfit: 3,
      slippage: 0.05,
    },
    source: "preset",
  },
];

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
  if (override.overrides.entry) {
    result.entry = override.overrides.entry;
  }
  if (override.overrides.exit) {
    result.exit = override.overrides.exit;
  }

  return result;
}
