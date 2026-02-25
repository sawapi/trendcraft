/**
 * Strategy Builder classes for backtesting
 * Extracted from trendcraft.ts to keep file sizes manageable
 */

import type { ExtendedCondition } from "../backtest/conditions/core";
import { runBacktest } from "../backtest/engine";
import type { MtfBacktestOptions } from "../backtest/engine";
import { type Result, ok, err, tcError } from "../types/result";
import type {
  BacktestOptions,
  BacktestResult,
  Condition,
  NormalizedCandle,
  TimeframeShorthand,
} from "../types";

/**
 * Strategy Builder for backtesting
 */
export class StrategyBuilder {
  protected _candles: NormalizedCandle[];
  protected _entryCondition: Condition | ExtendedCondition | null = null;
  protected _exitCondition: Condition | ExtendedCondition | null = null;

  constructor(candles: NormalizedCandle[]) {
    this._candles = candles;
  }

  /**
   * Set entry condition
   */
  entry(condition: Condition | ExtendedCondition): this {
    this._entryCondition = condition;
    return this;
  }

  /**
   * Set exit condition
   */
  exit(condition: Condition | ExtendedCondition): this {
    this._exitCondition = condition;
    return this;
  }

  /**
   * Run backtest with the configured strategy
   */
  backtest(options: BacktestOptions): BacktestResult {
    if (!this._entryCondition) {
      throw new Error("Entry condition is required. Use .entry() to set it.");
    }
    if (!this._exitCondition) {
      throw new Error("Exit condition is required. Use .exit() to set it.");
    }

    return runBacktest(this._candles, this._entryCondition, this._exitCondition, options);
  }

  /**
   * Safe variant of backtest that returns a Result instead of throwing.
   *
   * @example
   * ```ts
   * const result = TrendCraft.from(candles)
   *   .strategy()
   *   .entry(goldenCross())
   *   .exit(deadCross())
   *   .backtestSafe({ capital: 1000000 });
   *
   * if (result.ok) {
   *   console.log(result.value.totalReturnPercent);
   * } else {
   *   console.error(result.error.message);
   * }
   * ```
   */
  backtestSafe(options: BacktestOptions): Result<BacktestResult> {
    if (!this._entryCondition) {
      return err(tcError("MISSING_CONDITION", "Entry condition is required. Use .entry() to set it."));
    }
    if (!this._exitCondition) {
      return err(tcError("MISSING_CONDITION", "Exit condition is required. Use .exit() to set it."));
    }
    try {
      return ok(runBacktest(this._candles, this._entryCondition, this._exitCondition, options));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(tcError("BACKTEST_FAILED", message, {}, error instanceof Error ? error : undefined));
    }
  }
}

/**
 * MTF-enabled Strategy Builder for backtesting with multi-timeframe conditions
 */
export class MtfStrategyBuilder extends StrategyBuilder {
  private _mtfTimeframes: TimeframeShorthand[];

  constructor(candles: NormalizedCandle[], mtfTimeframes: TimeframeShorthand[]) {
    super(candles);
    this._mtfTimeframes = mtfTimeframes;
  }

  /**
   * Run backtest with MTF support
   */
  backtest(options: BacktestOptions): BacktestResult {
    if (!this._entryCondition) {
      throw new Error("Entry condition is required. Use .entry() to set it.");
    }
    if (!this._exitCondition) {
      throw new Error("Exit condition is required. Use .exit() to set it.");
    }

    const mtfOptions: MtfBacktestOptions = {
      ...options,
      mtfTimeframes: this._mtfTimeframes,
    };

    return runBacktest(this._candles, this._entryCondition, this._exitCondition, mtfOptions);
  }

  /**
   * Safe variant of backtest with MTF support that returns a Result instead of throwing.
   *
   * @example
   * ```ts
   * const result = TrendCraft.from(candles)
   *   .withMtf(["weekly"])
   *   .strategy()
   *   .entry(weeklyRsiAbove(50))
   *   .exit(deadCross())
   *   .backtestSafe({ capital: 1000000 });
   *
   * if (result.ok) {
   *   console.log(result.value.totalReturnPercent);
   * } else {
   *   console.error(result.error.message);
   * }
   * ```
   */
  backtestSafe(options: BacktestOptions): Result<BacktestResult> {
    if (!this._entryCondition) {
      return err(tcError("MISSING_CONDITION", "Entry condition is required. Use .entry() to set it."));
    }
    if (!this._exitCondition) {
      return err(tcError("MISSING_CONDITION", "Exit condition is required. Use .exit() to set it."));
    }
    try {
      const mtfOptions: MtfBacktestOptions = {
        ...options,
        mtfTimeframes: this._mtfTimeframes,
      };
      return ok(runBacktest(this._candles, this._entryCondition, this._exitCondition, mtfOptions));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(tcError("BACKTEST_FAILED", message, {}, error instanceof Error ? error : undefined));
    }
  }
}
