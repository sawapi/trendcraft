/**
 * Strategy Rotator — activates/deactivates strategies based on market regime
 *
 * Monitors regime changes and selects the appropriate strategy set:
 * - Strong trend (ADX > 25): Trend-following strategies
 * - Weak trend (ADX < 20): Mean-reversion strategies
 * - Bearish regime: Short + reversion strategies
 * - Sideways: Range-bound strategies (Bollinger, Keltner, VWAP)
 */

export type RegimeSnapshot = {
  volatility: "low" | "normal" | "high";
  trend: "bullish" | "bearish" | "sideways";
  trendStrength: number;
};

/** Strategy category for rotation logic */
export type StrategyCategory = "trend" | "reversion" | "short" | "range";

/** Mapping from strategy ID to its category */
const STRATEGY_CATEGORIES: Record<string, StrategyCategory> = {
  // Trend-following
  "macd-trend": "trend",
  "sma-golden-cross": "trend",
  "dmi-trend": "trend",
  "ema-crossover-trend": "trend",
  "macd-adx-filter": "trend",
  "ema-vwap-momentum": "trend",
  "ema-swing-daily": "trend",
  "ema-dead-cross-short": "short",

  // Mean-reversion
  "rsi-mean-reversion": "reversion",
  "bollinger-squeeze": "reversion",
  "bollinger-reversal": "reversion",
  "vwap-mean-reversion": "reversion",
  "vwap-band-reversion": "reversion",
  "gap-fade": "reversion",
  "rsi-swing-daily": "reversion",
  "stoch-momentum-swing": "reversion",

  // Range-bound
  "keltner-reversion": "range",
  "bollinger-swing-hourly": "range",

  // Short
  "rsi-overbought-short": "short",

  // SMC (context-dependent)
  "smc-ob-bounce": "reversion",
  "smc-sweep-reversal": "reversion",

  // Momentum (works in most regimes)
  "rsi-ema-momentum": "trend",
};

export type StrategyRotator = {
  /** Get the set of strategy IDs that should be active for the given regime */
  getActiveStrategies(regime: RegimeSnapshot): Set<string>;
  /** Process a regime change and return strategies to activate/deactivate */
  onRegimeChange(newRegime: RegimeSnapshot): {
    activate: string[];
    deactivate: string[];
  };
  /** Get the current regime */
  getCurrentRegime(): RegimeSnapshot | null;
  /** Get strategy category */
  getCategory(strategyId: string): StrategyCategory | undefined;
};

/**
 * Create a strategy rotator that maps regime states to strategy selections.
 *
 * @param availableStrategies - All strategy IDs registered in the system
 *
 * @example
 * ```ts
 * const rotator = createStrategyRotator(["macd-trend", "rsi-mean-reversion", ...]);
 * const { activate, deactivate } = rotator.onRegimeChange({
 *   volatility: "normal", trend: "bullish", trendStrength: 30,
 * });
 * ```
 */
export function createStrategyRotator(availableStrategies: string[]): StrategyRotator {
  let currentRegime: RegimeSnapshot | null = null;
  let currentActive = new Set<string>(availableStrategies);

  function getActiveForRegime(regime: RegimeSnapshot): Set<string> {
    const active = new Set<string>();

    for (const strategyId of availableStrategies) {
      const category = STRATEGY_CATEGORIES[strategyId];
      if (!category) {
        // Unknown category — always active
        active.add(strategyId);
        continue;
      }

      const shouldActivate = shouldBeActive(category, regime);
      if (shouldActivate) {
        active.add(strategyId);
      }
    }

    return active;
  }

  return {
    getActiveStrategies(regime: RegimeSnapshot): Set<string> {
      return getActiveForRegime(regime);
    },

    onRegimeChange(newRegime: RegimeSnapshot) {
      const newActive = getActiveForRegime(newRegime);
      const activate: string[] = [];
      const deactivate: string[] = [];

      for (const id of newActive) {
        if (!currentActive.has(id)) activate.push(id);
      }
      for (const id of currentActive) {
        if (!newActive.has(id)) deactivate.push(id);
      }

      currentRegime = newRegime;
      currentActive = newActive;

      return { activate, deactivate };
    },

    getCurrentRegime(): RegimeSnapshot | null {
      return currentRegime;
    },

    getCategory(strategyId: string): StrategyCategory | undefined {
      return STRATEGY_CATEGORIES[strategyId];
    },
  };
}

/**
 * Determine if a strategy category should be active for a given regime.
 */
function shouldBeActive(category: StrategyCategory, regime: RegimeSnapshot): boolean {
  const { trend, trendStrength, volatility } = regime;
  const strongTrend = trendStrength >= 25;
  const weakTrend = trendStrength < 20;

  switch (category) {
    case "trend":
      // Active in strong trends (bullish or bearish)
      return strongTrend && (trend === "bullish" || trend === "bearish");

    case "reversion":
      // Active in weak trends or sideways, not in high volatility
      return (weakTrend || trend === "sideways") && volatility !== "high";

    case "short":
      // Active in bearish trends or strong bearish
      return trend === "bearish";

    case "range":
      // Active in sideways or low volatility
      return trend === "sideways" || volatility === "low";

    default:
      return true;
  }
}
