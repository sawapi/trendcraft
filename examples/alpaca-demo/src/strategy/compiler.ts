/**
 * Template Compiler — converts StrategyTemplate to StrategyDefinition
 *
 * Uses a safe switch/map approach (no eval). Each indicator type and
 * condition type maps to a known trendcraft factory function.
 */

import {
  incremental,
  streaming,
  rsiBelow as backtestRsiBelow,
  rsiAbove as backtestRsiAbove,
  macdCrossUp,
  macdCrossDown,
  goldenCrossCondition as backtestGoldenCross,
  deadCrossCondition as backtestDeadCross,
  and as backtestAnd,
  or as backtestOr,
  type NormalizedCandle,
  type Condition,
  type SignalManagerOptions,
} from "trendcraft";
import type { StrategyDefinition } from "./types.js";
import type {
  StrategyTemplate,
  ConditionRule,
  ConditionRef,
  IndicatorRef,
} from "./template.js";
import { isCombined } from "./template.js";
import { US_MARKET_HOURS } from "../config/market-hours.js";

export type CompileResult =
  | { ok: true; strategy: StrategyDefinition }
  | { ok: false; error: string };

/**
 * Compile a StrategyTemplate into an executable StrategyDefinition
 */
export function compileTemplate(template: StrategyTemplate): CompileResult {
  try {
    const pipeline = buildPipeline(template);
    const backtestAdapter = buildBacktestAdapter(template);

    const signalLifecycle = buildSignalLifecycle(template);

    const strategy: StrategyDefinition = {
      id: template.id,
      name: template.name,
      description: template.description,
      intervalMs: template.intervalMs,
      symbols: template.symbols,
      pipeline,
      guards: {
        riskGuard: {
          maxDailyLoss: template.guards.maxDailyLoss,
          maxDailyTrades: template.guards.maxDailyTrades,
        },
        timeGuard: US_MARKET_HOURS,
      },
      position: buildPosition(template),
      ...(signalLifecycle && { signalLifecycle }),
      backtestAdapter,
    };

    return { ok: true, strategy };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Indicator compilation ---

type IncrementalFactory = () => incremental.IncrementalIndicator<unknown>;

function compileIndicator(ind: IndicatorRef): IncrementalFactory {
  switch (ind.type) {
    case "rsi":
      return () => incremental.createRsi({ period: ind.params.period ?? 14 });
    case "macd":
      return () =>
        incremental.createMacd({
          fastPeriod: ind.params.fastPeriod ?? 12,
          slowPeriod: ind.params.slowPeriod ?? 26,
          signalPeriod: ind.params.signalPeriod ?? 9,
        });
    case "bollinger":
      return () =>
        incremental.createBollingerBands({
          period: ind.params.period ?? 20,
          stdDev: ind.params.stdDev ?? 2,
        });
    case "ema":
      return () => incremental.createEma({ period: ind.params.period ?? 9 });
    case "sma":
      return () => incremental.createSma({ period: ind.params.period ?? 20 });
    case "vwap":
      return () => incremental.createVwap();
    case "atr":
      return () => incremental.createAtr({ period: ind.params.period ?? 14 });
    case "stochastics":
      return () =>
        incremental.createStochastics({
          kPeriod: ind.params.kPeriod ?? 14,
          dPeriod: ind.params.dPeriod ?? 3,
        });
    case "dmi":
      return () => incremental.createDmi({ period: ind.params.period ?? 14 });
    default:
      throw new Error(`Unknown indicator type: ${ind.type}`);
  }
}

function buildPipeline(template: StrategyTemplate): streaming.PipelineOptions {
  const indicators = template.indicators.map((ind) => ({
    name: ind.name,
    create: compileIndicator(ind),
  }));

  const entry = compileStreamingCondition(template.entry, template.indicators);
  const exit = compileStreamingCondition(template.exit, template.indicators);

  return { indicators, entry, exit };
}

// --- Streaming condition compilation ---

function compileStreamingConditionRef(
  ref: ConditionRef,
  indicators: IndicatorRef[],
): streaming.StreamingCondition {
  switch (ref.type) {
    case "rsiBelow":
      return streaming.rsiBelow(
        (ref.params?.threshold as number) ?? 30,
        findIndicatorName(indicators, "rsi"),
      );
    case "rsiAbove":
      return streaming.rsiAbove(
        (ref.params?.threshold as number) ?? 70,
        findIndicatorName(indicators, "rsi"),
      );
    case "macdPositive":
      return streaming.macdPositive(findIndicatorName(indicators, "macd"));
    case "macdNegative":
      return streaming.macdNegative(findIndicatorName(indicators, "macd"));
    case "priceAbove": {
      const key = resolveIndicatorKey(
        ref.params?.indicatorKey as string,
        indicators,
      );
      return buildPriceCondition("above", key, indicators);
    }
    case "priceBelow": {
      const key = resolveIndicatorKey(
        ref.params?.indicatorKey as string,
        indicators,
      );
      return buildPriceCondition("below", key, indicators);
    }
    case "smaGoldenCross":
      return streaming.smaGoldenCross();
    case "smaDeadCross":
      return streaming.smaDeadCross();
    case "indicatorAbove":
      return streaming.indicatorAbove(
        ref.params?.indicatorKey as string,
        (ref.params?.threshold as number) ?? 0,
      );
    case "indicatorBelow":
      return streaming.indicatorBelow(
        ref.params?.indicatorKey as string,
        (ref.params?.threshold as number) ?? 0,
      );
    default:
      throw new Error(`Unknown condition type: ${ref.type}`);
  }
}

function compileStreamingCondition(
  rule: ConditionRule,
  indicators: IndicatorRef[],
): streaming.StreamingCondition {
  if (isCombined(rule)) {
    const compiled = rule.conditions.map((c) =>
      compileStreamingConditionRef(c, indicators),
    );
    return rule.operator === "and"
      ? streaming.and(...compiled)
      : streaming.or(...compiled);
  }
  return compileStreamingConditionRef(rule, indicators);
}

// --- Backtest condition compilation ---

function buildBacktestAdapter(template: StrategyTemplate) {
  const entryCondition = compileBacktestCondition(
    template.entry,
    template.indicators,
  );
  const exitCondition = compileBacktestCondition(
    template.exit,
    template.indicators,
  );

  return {
    entryCondition,
    exitCondition,
    options: {
      stopLoss: template.position.stopLoss,
      ...(template.position.takeProfit !== undefined && {
        takeProfit: template.position.takeProfit,
      }),
      ...(template.position.trailingStop !== undefined && {
        trailingStop: template.position.trailingStop,
      }),
      ...(template.position.atrTrailingStop && {
        atrTrailingStop: template.position.atrTrailingStop,
      }),
      ...(template.position.partialTakeProfit && {
        partialTakeProfit: {
          threshold: template.position.partialTakeProfit.threshold,
          sellPercent: template.position.partialTakeProfit.portion,
        },
      }),
      ...(template.position.breakEvenStop && {
        breakevenStop: {
          threshold: template.position.breakEvenStop.triggerPercent,
          buffer: template.position.breakEvenStop.offset,
        },
      }),
      slippage: template.position.slippage,
    },
  };
}

function compileBacktestConditionRef(
  ref: ConditionRef,
  indicators: IndicatorRef[],
): Condition {
  switch (ref.type) {
    case "rsiBelow":
      return backtestRsiBelow((ref.params?.threshold as number) ?? 30);
    case "rsiAbove":
      return backtestRsiAbove((ref.params?.threshold as number) ?? 70);
    case "macdPositive": {
      const macdInd = indicators.find((i) => i.type === "macd");
      return macdCrossUp(
        macdInd?.params.fastPeriod ?? 12,
        macdInd?.params.slowPeriod ?? 26,
        macdInd?.params.signalPeriod ?? 9,
      );
    }
    case "macdNegative": {
      const macdInd = indicators.find((i) => i.type === "macd");
      return macdCrossDown(
        macdInd?.params.fastPeriod ?? 12,
        macdInd?.params.slowPeriod ?? 26,
        macdInd?.params.signalPeriod ?? 9,
      );
    }
    case "priceAbove":
    case "priceBelow":
    case "indicatorAbove":
    case "indicatorBelow":
      // These require custom functions for backtest
      return buildBacktestCustomCondition(ref);
    case "smaGoldenCross":
      return backtestGoldenCross();
    case "smaDeadCross":
      return backtestDeadCross();
    default:
      throw new Error(`Unknown backtest condition type: ${ref.type}`);
  }
}

function compileBacktestCondition(
  rule: ConditionRule,
  indicators: IndicatorRef[],
): Condition {
  if (isCombined(rule)) {
    const compiled = rule.conditions.map((c) =>
      compileBacktestConditionRef(c, indicators),
    );
    return rule.operator === "and"
      ? backtestAnd(...compiled)
      : backtestOr(...compiled);
  }
  return compileBacktestConditionRef(rule, indicators);
}

// --- Helpers ---

function findIndicatorName(
  indicators: IndicatorRef[],
  type: string,
): string {
  const found = indicators.find((i) => i.type === type);
  return found?.name ?? type;
}

/**
 * Resolve indicator keys like "bb.lower" into the actual indicator name
 * and sub-field path.
 */
function resolveIndicatorKey(
  key: string,
  _indicators: IndicatorRef[],
): string {
  return key;
}

/**
 * Build streaming priceAbove/priceBelow that handles dotted keys like "bb.lower"
 */
function buildPriceCondition(
  direction: "above" | "below",
  key: string,
  _indicators: IndicatorRef[],
): streaming.StreamingCondition {
  const parts = key.split(".");
  if (parts.length === 2) {
    // Compound key like "bb.lower" — need custom streaming condition
    const [indicatorName, field] = parts;
    const fn: streaming.StreamingConditionFn = (
      snapshot: streaming.IndicatorSnapshot,
      candle: NormalizedCandle,
    ) => {
      const val = snapshot[indicatorName];
      if (val && typeof val === "object" && field in (val as Record<string, unknown>)) {
        const num = (val as Record<string, number>)[field];
        if (typeof num !== "number") return false;
        return direction === "above" ? candle.close > num : candle.close < num;
      }
      return false;
    };
    return fn;
  }
  // Simple key — check if it's a VWAP-style nested value
  if (key === "vwap") {
    const fn: streaming.StreamingConditionFn = (
      snapshot: streaming.IndicatorSnapshot,
      candle: NormalizedCandle,
    ) => {
      const val = snapshot.vwap;
      let vwapPrice: number | null = null;
      if (typeof val === "number") {
        vwapPrice = val;
      } else if (val && typeof val === "object" && "vwap" in (val as Record<string, unknown>)) {
        vwapPrice = (val as { vwap: number | null }).vwap;
      }
      if (vwapPrice === null) return false;
      return direction === "above"
        ? candle.close > vwapPrice
        : candle.close < vwapPrice;
    };
    return fn;
  }
  return direction === "above"
    ? streaming.priceAbove(key)
    : streaming.priceBelow(key);
}

/**
 * Build custom backtest condition for price/indicator comparisons
 */
function buildBacktestCustomCondition(
  ref: ConditionRef,
): Condition {
  const key = ref.params?.indicatorKey as string;
  const threshold = ref.params?.threshold as number | undefined;

  return (indicators, candle) => {
    const parts = key?.split(".") ?? [];
    let value: number | null = null;

    if (parts.length === 2) {
      // e.g., "bb.lower"
      const series = indicators[parts[0]] as
        | { time: number; value: Record<string, number> }[]
        | undefined;
      if (series) {
        const entry = series.find((e) => e.time === candle.time);
        if (entry?.value) value = entry.value[parts[1]] ?? null;
      }
    } else if (key) {
      const series = indicators[key] as
        | { time: number; value: unknown }[]
        | undefined;
      if (series) {
        const entry = series.find((e) => e.time === candle.time);
        if (entry) {
          if (typeof entry.value === "number") {
            value = entry.value;
          } else if (entry.value && typeof entry.value === "object") {
            const obj = entry.value as Record<string, unknown>;
            // Extract primary value from known multi-value indicators
            if ("vwap" in obj) {
              value = (obj.vwap as number) ?? null;
            } else if ("k" in obj) {
              // Stochastics: use K line as primary value
              value = (obj.k as number) ?? null;
            } else if ("adx" in obj) {
              // DMI: use ADX as primary value
              value = (obj.adx as number) ?? null;
            } else if ("middle" in obj) {
              // Bollinger: use middle as primary value
              value = (obj.middle as number) ?? null;
            }
          }
        }
      }
    }

    if (value === null) return false;

    switch (ref.type) {
      case "priceAbove":
        return candle.close > value;
      case "priceBelow":
        return candle.close < value;
      case "indicatorAbove":
        return value > (threshold ?? 0);
      case "indicatorBelow":
        return value < (threshold ?? 0);
      default:
        return false;
    }
  };
}

function buildSignalLifecycle(
  template: StrategyTemplate,
): SignalManagerOptions | undefined {
  const lc = template.signalLifecycle;
  if (!lc) return undefined;
  if (!lc.cooldownBars && !lc.debounceBars && !lc.expiryBars) return undefined;

  return {
    ...(lc.cooldownBars && { cooldown: { bars: lc.cooldownBars } }),
    ...(lc.debounceBars && { debounce: { bars: lc.debounceBars } }),
    ...(lc.expiryBars && { expiry: { bars: lc.expiryBars } }),
  };
}

function buildPosition(
  template: StrategyTemplate,
): streaming.PositionManagerOptions {
  let sizing: streaming.PositionManagerOptions["sizing"];

  switch (template.position.sizingMethod) {
    case "risk-based":
      sizing = {
        method: "risk-based" as const,
        riskPercent: template.position.riskPercent ?? 1,
      };
      break;
    case "fixed-fractional":
      sizing = {
        method: "fixed-fractional" as const,
        fractionPercent: template.position.riskPercent ?? 10,
      };
      break;
    case "kelly":
      // Kelly maps to fixed-fractional with half-Kelly default (5%)
      // The actual Kelly percentage gets recalculated by the agent
      // based on live win rate and payoff ratio
      sizing = {
        method: "fixed-fractional" as const,
        fractionPercent: (template.position.riskPercent ?? 5) * 0.5,
      };
      break;
    default:
      sizing = { method: "full-capital" as const };
  }

  return {
    capital: template.position.capital,
    sizing,
    stopLoss: template.position.stopLoss,
    ...(template.position.takeProfit !== undefined && {
      takeProfit: template.position.takeProfit,
    }),
    ...(template.position.trailingStop !== undefined && {
      trailingStop: template.position.trailingStop,
    }),
    slippage: template.position.slippage,
  };
}
