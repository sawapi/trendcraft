import {
  type BacktestOptions,
  type BacktestResult,
  type EquityCurveAnalysis,
  type EquityCurveFilterType,
  type EquityCurveHealthResult,
  type StrategyJSON,
  type StrategyPerformanceMetric,
  type StrategyRotationOptions,
  type StrategyRotationResult,
  applyEquityCurveFilter,
  backtestRegistry,
  equityCurveHealth,
  loadStrategy,
  normalizeCandles,
  rotateStrategies,
  runBacktest,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

/**
 * Project the runtime settings of a finished backtest onto a `BacktestOptions`
 * shape so demo strategies can be re-run with the same assumptions. Without
 * this, the user's strategy and the demos compete with different stop/TP/
 * commission/slippage rules and the rotation ranking measures the settings
 * difference, not the strategy edge.
 */
export function overridesFromResult(result: BacktestResult): Partial<BacktestOptions> {
  return {
    capital: result.initialCapital,
    direction: result.settings.direction,
    stopLoss: result.settings.stopLoss,
    takeProfit: result.settings.takeProfit,
    trailingStop: result.settings.trailingStop,
    fillMode: result.settings.fillMode,
    slTpMode: result.settings.slTpMode,
    slippage: result.settings.slippage,
    commission: result.settings.commission,
    commissionRate: result.settings.commissionRate,
    taxRate: result.settings.taxRate,
  };
}

export type AllocationMethod = NonNullable<StrategyRotationOptions["allocationMethod"]>;

export type FilterInputs = {
  type: EquityCurveFilterType;
  maPeriod: number;
  maxDrawdown: number;
  minWinRate: number;
  filteredSizeFactor: number;
};

export const DEFAULT_FILTER_INPUTS: FilterInputs = {
  type: "ma",
  maPeriod: 10,
  maxDrawdown: 15,
  minWinRate: 40,
  filteredSizeFactor: 0,
};

export type RotationInputs = {
  metric: StrategyPerformanceMetric;
  lookbackTrades: number;
  allocation: AllocationMethod;
  maxActive: number;
};

export const DEFAULT_ROTATION_INPUTS: RotationInputs = {
  metric: "returnPercent",
  lookbackTrades: 20,
  allocation: "proportional",
  maxActive: 3,
};

export type FilterComputation =
  | { kind: "ok"; analysis: EquityCurveAnalysis; health: EquityCurveHealthResult }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function computeFilter(
  result: BacktestResult | undefined,
  inputs: FilterInputs,
): FilterComputation {
  if (!result) return { kind: "empty" };
  if (result.trades.length === 0) return { kind: "empty" };
  try {
    const analysis = applyEquityCurveFilter(result, {
      type: inputs.type,
      maPeriod: inputs.maPeriod,
      maxDrawdown: inputs.maxDrawdown,
      minWinRate: inputs.minWinRate,
      filteredSizeFactor: inputs.filteredSizeFactor,
    });
    const health = equityCurveHealth(result, { maPeriod: inputs.maPeriod });
    return { kind: "ok", analysis, health };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export type RotationSlot = {
  /** Display label shown in the panel — "Slot 1: your strategy" etc. */
  label: string;
  /** Source: "user" when fed from the live builder, "demo" for hardcoded. */
  source: "user" | "demo";
  result: BacktestResult;
};

export type RotationComputation =
  | {
      kind: "ok";
      slots: RotationSlot[];
      rotation: StrategyRotationResult;
    }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export type DemoBacktest = {
  strategy: StrategyJSON;
  result: BacktestResult;
};

/**
 * Run each demo strategy against the candle slice and pair every result back
 * with its source strategy. The pairing matters: the panel labels rows from
 * `strategy.name`, so a `BacktestResult[]` that silently dropped a failed
 * strategy would shift labels and mislead the user.
 *
 * `overrides` lets the caller force shared backtest assumptions (stops,
 * commission, fill mode, etc.) so the rotation comparison is apples-to-apples
 * with the user's strategy. Demo-specific defaults from each `strategy.json`
 * sit underneath; overrides win on conflict.
 */
export function runDemoBacktests(
  candles: StudioCandle[],
  demos: ReadonlyArray<StrategyJSON>,
  overrides: Partial<BacktestOptions> = {},
): DemoBacktest[] {
  const normalized = normalizeCandles(candles);
  const out: DemoBacktest[] = [];
  for (const strategy of demos) {
    try {
      const { entry, exit, backtestOptions } = loadStrategy(strategy, backtestRegistry);
      const result = runBacktest(normalized, entry, exit, {
        capital: 100_000,
        ...backtestOptions,
        ...overrides,
      });
      out.push({ strategy, result });
    } catch (err) {
      console.warn(`[strategy-studio] Demo backtest failed for ${strategy.name}:`, err);
    }
  }
  return out;
}

export function buildRotation(slots: RotationSlot[], inputs: RotationInputs): RotationComputation {
  if (slots.length === 0) return { kind: "empty" };
  try {
    const rotation = rotateStrategies(
      slots.map((s) => s.result),
      {
        rankingMetric: inputs.metric,
        lookbackTrades: inputs.lookbackTrades,
        allocationMethod: inputs.allocation,
        maxActiveStrategies: Math.min(inputs.maxActive, slots.length),
      },
    );
    return { kind: "ok", slots, rotation };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
