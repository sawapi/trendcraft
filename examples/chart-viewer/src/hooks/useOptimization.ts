/**
 * Optimization state management hook
 *
 * Manages grid search and walk-forward analysis state.
 * Currently runs synchronously; a Web Worker could be added later
 * for non-blocking execution on large parameter spaces.
 */

import { useCallback, useRef, useState } from "react";
import type {
  GridSearchResult,
  NormalizedCandle,
  OptimizationMetric,
  ParameterRange,
  WalkForwardResult,
} from "trendcraft";
import * as TC from "trendcraft";
import { ENTRY_CONDITIONS, EXIT_CONDITIONS } from "./useBacktest";

// ── Types ──────────────────────────────────────────────────────────

export type OptimizationTab = "gridSearch" | "walkForward";

export interface ParameterRangeConfig {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface GridSearchConfig {
  entryCondition: string;
  exitCondition: string;
  metric: OptimizationMetric;
  parameterRanges: ParameterRangeConfig[];
  capital: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface WalkForwardConfig extends GridSearchConfig {
  windowSize: number;
  stepSize: number;
  testSize: number;
}

export interface OptimizationState {
  tab: OptimizationTab;
  isRunning: boolean;
  progress: { current: number; total: number } | null;
  gridSearchResult: GridSearchResult | null;
  walkForwardResult: WalkForwardResult | null;
  error: string | null;
}

// ── Preset parameter templates ─────────────────────────────────────

export const PARAMETER_TEMPLATES: Record<
  string,
  { label: string; ranges: ParameterRangeConfig[] }
> = {
  maCross: {
    label: "MA Cross Periods",
    ranges: [
      { id: "fast", name: "fastPeriod", min: 3, max: 15, step: 2 },
      { id: "slow", name: "slowPeriod", min: 15, max: 50, step: 5 },
    ],
  },
  rsiThreshold: {
    label: "RSI Thresholds",
    ranges: [
      { id: "entry", name: "rsiEntry", min: 20, max: 40, step: 5 },
      { id: "exit", name: "rsiExit", min: 60, max: 80, step: 5 },
    ],
  },
  stopTakeProfit: {
    label: "Stop Loss / Take Profit",
    ranges: [
      { id: "sl", name: "stopLoss", min: 2, max: 10, step: 1 },
      { id: "tp", name: "takeProfit", min: 5, max: 25, step: 5 },
    ],
  },
};

// ── Default configs ───────────────────────────────────────────────

const DEFAULT_GRID_CONFIG: GridSearchConfig = {
  entryCondition: "gc",
  exitCondition: "dc",
  metric: "sharpe",
  parameterRanges: [
    { id: "fast", name: "fastPeriod", min: 3, max: 15, step: 2 },
    { id: "slow", name: "slowPeriod", min: 15, max: 50, step: 5 },
  ],
  capital: 1000000,
};

const DEFAULT_WF_CONFIG: WalkForwardConfig = {
  ...DEFAULT_GRID_CONFIG,
  windowSize: 252,
  stepSize: 63,
  testSize: 63,
};

// ── Strategy factory builder ──────────────────────────────────────

/**
 * Build a StrategyFactory from a condition key and parameter ranges.
 * The factory maps numeric parameters to condition factories.
 */
function buildStrategyFactory(
  entryKey: string,
  exitKey: string,
  config: GridSearchConfig,
): (params: Record<string, number>) => {
  entry: TC.Condition;
  exit: TC.Condition;
  options?: TC.BacktestOptions;
} {
  return (params: Record<string, number>) => {
    // Determine entry condition - use parameterized version if params match
    let entry: TC.Condition;
    if (entryKey === "gc" && params.fastPeriod !== undefined && params.slowPeriod !== undefined) {
      entry = TC.goldenCrossCondition(params.fastPeriod, params.slowPeriod);
    } else if (entryKey === "rsi30" && params.rsiEntry !== undefined) {
      entry = TC.rsiBelow(params.rsiEntry);
    } else if (entryKey === "rsi40" && params.rsiEntry !== undefined) {
      entry = TC.rsiBelow(params.rsiEntry);
    } else {
      const factory = ENTRY_CONDITIONS[entryKey]?.factory;
      entry = factory ? factory() : TC.goldenCrossCondition(5, 25);
    }

    // Determine exit condition
    let exit: TC.Condition;
    if (exitKey === "dc" && params.fastPeriod !== undefined && params.slowPeriod !== undefined) {
      exit = TC.deadCrossCondition(params.fastPeriod, params.slowPeriod);
    } else if (exitKey === "rsi70" && params.rsiExit !== undefined) {
      exit = TC.rsiAbove(params.rsiExit);
    } else if (exitKey === "rsi60" && params.rsiExit !== undefined) {
      exit = TC.rsiAbove(params.rsiExit);
    } else {
      const factory = EXIT_CONDITIONS[exitKey]?.factory;
      exit = factory ? factory() : TC.deadCrossCondition(5, 25);
    }

    const options: TC.BacktestOptions = {
      capital: config.capital,
    };
    if (params.stopLoss !== undefined) {
      options.stopLoss = params.stopLoss;
    } else if (config.stopLoss !== undefined) {
      options.stopLoss = config.stopLoss;
    }
    if (params.takeProfit !== undefined) {
      options.takeProfit = params.takeProfit;
    } else if (config.takeProfit !== undefined) {
      options.takeProfit = config.takeProfit;
    }

    return { entry, exit, options };
  };
}

// ── Hook ──────────────────────────────────────────────────────────

export function useOptimization(candles: NormalizedCandle[]) {
  const [tab, setTab] = useState<OptimizationTab>("gridSearch");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [gridSearchResult, setGridSearchResult] = useState<GridSearchResult | null>(null);
  const [walkForwardResult, setWalkForwardResult] = useState<WalkForwardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gridConfig, setGridConfig] = useState<GridSearchConfig>(DEFAULT_GRID_CONFIG);
  const [wfConfig, setWfConfig] = useState<WalkForwardConfig>(DEFAULT_WF_CONFIG);

  // Abort ref for potential future async support
  const abortRef = useRef(false);

  const runGridSearch = useCallback(() => {
    if (candles.length < 50) {
      setError("Not enough data (minimum 50 candles)");
      return;
    }

    setIsRunning(true);
    setError(null);
    setGridSearchResult(null);
    setProgress({ current: 0, total: 0 });
    abortRef.current = false;

    // Use setTimeout to allow UI to update before blocking
    setTimeout(() => {
      try {
        const ranges: ParameterRange[] = gridConfig.parameterRanges.map((r) => ({
          name: r.name,
          min: r.min,
          max: r.max,
          step: r.step,
        }));

        const totalCombs = TC.countCombinations(ranges);
        if (totalCombs > 10000) {
          setError(
            `Too many combinations (${totalCombs}). Reduce ranges or increase step size. Max: 10,000.`,
          );
          setIsRunning(false);
          setProgress(null);
          return;
        }

        const factory = buildStrategyFactory(
          gridConfig.entryCondition,
          gridConfig.exitCondition,
          gridConfig,
        );

        const result = TC.gridSearch(candles, factory, ranges, {
          metric: gridConfig.metric,
          maxCombinations: 10000,
          keepAllResults: true,
          progressCallback: (current, total) => {
            setProgress({ current, total });
          },
        });

        setGridSearchResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    }, 50);
  }, [candles, gridConfig]);

  const runWalkForward = useCallback(() => {
    if (candles.length < 50) {
      setError("Not enough data (minimum 50 candles)");
      return;
    }

    setIsRunning(true);
    setError(null);
    setWalkForwardResult(null);
    setProgress({ current: 0, total: 0 });

    setTimeout(() => {
      try {
        const ranges: ParameterRange[] = wfConfig.parameterRanges.map((r) => ({
          name: r.name,
          min: r.min,
          max: r.max,
          step: r.step,
        }));

        const factory = buildStrategyFactory(
          wfConfig.entryCondition,
          wfConfig.exitCondition,
          wfConfig,
        );

        const result = TC.walkForwardAnalysis(candles, factory, ranges, {
          windowSize: wfConfig.windowSize,
          stepSize: wfConfig.stepSize,
          testSize: wfConfig.testSize,
          metric: wfConfig.metric,
          progressCallback: (current, total) => {
            setProgress({ current, total });
          },
        });

        setWalkForwardResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    }, 50);
  }, [candles, wfConfig]);

  const clearResults = useCallback(() => {
    setGridSearchResult(null);
    setWalkForwardResult(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    // State
    tab,
    isRunning,
    progress,
    gridSearchResult,
    walkForwardResult,
    error,
    gridConfig,
    wfConfig,

    // Actions
    setTab,
    setGridConfig,
    setWfConfig,
    runGridSearch,
    runWalkForward,
    clearResults,
  };
}
