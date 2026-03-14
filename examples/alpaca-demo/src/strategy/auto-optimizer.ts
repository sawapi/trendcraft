/**
 * Auto-Optimizer Preflight — runs Walk-Forward analysis before live trading
 *
 * Optimizes strategy parameters on historical data for each symbol,
 * producing parameter overrides that can be applied at session start.
 */

import {
  type NormalizedCandle,
  type ParameterRange,
  type WalkForwardResult,
  runBacktest,
  walkForwardAnalysis,
} from "trendcraft";
import { compileTemplate } from "./compiler.js";
import type { ParameterOverride, StrategyTemplate } from "./template.js";

export type OptimizationConfig = {
  /** Maximum time to spend on optimization per strategy-symbol pair (ms) */
  maxTimeMs?: number;
  /** Walk-forward window size in candles (default: 60% of data) */
  windowSize?: number;
  /** Walk-forward step size in candles (default: 20% of data) */
  stepSize?: number;
  /** Walk-forward test size in candles (default: 20% of data) */
  testSize?: number;
};

/**
 * Optimizable parameters for each indicator type
 */
const PARAMETER_RANGES: Record<string, ParameterRange[]> = {
  rsi: [{ name: "rsiPeriod", min: 10, max: 20, step: 2 }],
  ema: [{ name: "emaPeriod", min: 5, max: 30, step: 5 }],
  sma: [{ name: "smaPeriod", min: 10, max: 50, step: 10 }],
  bollinger: [
    { name: "bbPeriod", min: 15, max: 25, step: 5 },
    { name: "bbStdDev", min: 1.5, max: 2.5, step: 0.5 },
  ],
};

/**
 * Explicit mapping from WFA parameter names to indicator params.
 * Used to safely map optimized parameter values back to indicator configs.
 */
const INDICATOR_PARAM_KEYS: Record<string, Record<string, string>> = {
  rsi: { rsiPeriod: "period" },
  ema: { emaPeriod: "period" },
  sma: { smaPeriod: "period" },
  bollinger: { bbPeriod: "period", bbStdDev: "stdDev" },
};

/**
 * Run Walk-Forward optimization for a strategy-symbol pair.
 *
 * @param template - Strategy template to optimize
 * @param candles - Historical candle data
 * @param config - Optimization configuration
 * @returns Parameter override if optimization improved results, null otherwise
 *
 * @example
 * ```ts
 * const override = optimizeStrategy(template, candles);
 * if (override) {
 *   console.log("Optimized:", override.overrides);
 * }
 * ```
 */
export function optimizeStrategy(
  template: StrategyTemplate,
  candles: NormalizedCandle[],
  config: OptimizationConfig = {},
): ParameterOverride | null {
  if (candles.length < 100) {
    return null; // Not enough data for meaningful optimization
  }

  // Determine parameter ranges based on template indicators
  const ranges: ParameterRange[] = [];
  for (const ind of template.indicators) {
    const indRanges = PARAMETER_RANGES[ind.type];
    if (indRanges) {
      ranges.push(...indRanges);
    }
  }

  if (ranges.length === 0) {
    return null; // No optimizable parameters
  }

  // Compile the base strategy for baseline comparison
  const baseResult = compileTemplate(template);
  if (!baseResult.ok) return null;
  if (!baseResult.strategy.backtestEntry || !baseResult.strategy.backtestExit) return null;

  try {
    // Run baseline backtest
    const baseline = runBacktest(
      candles,
      baseResult.strategy.backtestEntry,
      baseResult.strategy.backtestExit,
      { capital: 100_000, ...baseResult.strategy.backtestOptions },
    );

    const baselineSharpe = baseline.sharpeRatio;

    // Run Walk-Forward optimization
    const wfResult = walkForwardAnalysis(
      candles,
      (params) => {
        // Create a modified template with the given parameters
        const modified = { ...template };
        modified.indicators = template.indicators.map((ind) => {
          const newParams = { ...ind.params };
          const keyMap = INDICATOR_PARAM_KEYS[ind.type];
          if (keyMap) {
            for (const [rangeName, paramKey] of Object.entries(keyMap)) {
              if (params[rangeName] !== undefined) {
                newParams[paramKey] = params[rangeName];
              }
            }
          }
          return { ...ind, params: newParams };
        });

        const compiled = compileTemplate(modified);
        if (!compiled.ok || !compiled.strategy.backtestEntry || !compiled.strategy.backtestExit) {
          return { entry: () => false, exit: () => false };
        }
        return {
          entry: compiled.strategy.backtestEntry,
          exit: compiled.strategy.backtestExit,
          options: { capital: 100_000, ...compiled.strategy.backtestOptions },
        };
      },
      ranges,
      {
        windowSize: config.windowSize ?? Math.floor(candles.length * 0.6),
        stepSize: config.stepSize ?? Math.floor(candles.length * 0.2),
        testSize: config.testSize ?? Math.floor(candles.length * 0.2),
        metric: "sharpe",
      },
    );

    // Only apply if optimization meaningfully improves Sharpe
    const oosSharpe = wfResult.aggregateMetrics.avgOutOfSample.sharpe ?? 0;
    const stability = wfResult.aggregateMetrics.stabilityRatio;
    if (oosSharpe > baselineSharpe + 0.1 && stability > 0.5) {
      const bestParams = wfResult.periods[wfResult.periods.length - 1]?.bestParams;
      if (!bestParams) return null;

      return {
        strategyId: template.id,
        overrides: {
          indicators: template.indicators.map((ind) => {
            const newParams = { ...ind.params };
            const keyMap = INDICATOR_PARAM_KEYS[ind.type];
            if (keyMap) {
              for (const [rangeName, paramKey] of Object.entries(keyMap)) {
                if (bestParams[rangeName] !== undefined) {
                  newParams[paramKey] = bestParams[rangeName];
                }
              }
            }
            return { ...ind, params: newParams };
          }),
        },
        appliedAt: Date.now(),
        reasoning: `Walk-forward optimized: Sharpe ${baselineSharpe.toFixed(2)} → ${oosSharpe.toFixed(2)} (stability: ${(stability * 100).toFixed(0)}%)`,
      };
    }

    return null;
  } catch (err) {
    console.warn(
      `[OPTIMIZER] Failed for ${template.id}: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

/**
 * Run preflight optimization for all strategy-symbol pairs.
 *
 * @param templates - Strategy templates to optimize
 * @param candlesBySymbol - Historical candles per symbol
 * @param config - Optimization configuration
 * @returns Array of parameter overrides
 */
export function preflightOptimize(
  templates: StrategyTemplate[],
  candlesBySymbol: Map<string, NormalizedCandle[]>,
  config: OptimizationConfig = {},
): ParameterOverride[] {
  const overrides: ParameterOverride[] = [];

  for (const template of templates) {
    for (const symbol of template.symbols) {
      const candles = candlesBySymbol.get(symbol);
      if (!candles) continue;

      const override = optimizeStrategy(template, candles, config);
      if (override) {
        console.log(`[OPTIMIZER] ${template.id}:${symbol} — ${override.reasoning}`);
        overrides.push(override);
      }
    }
  }

  return overrides;
}
