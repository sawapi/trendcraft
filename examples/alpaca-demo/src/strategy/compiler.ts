/**
 * Template Compiler — converts StrategyTemplate to StrategyDefinition
 *
 * Uses a safe switch/map approach (no eval). Each indicator type and
 * condition type maps to a known trendcraft factory function.
 */

import {
  type Condition,
  type NormalizedCandle,
  type SignalManagerOptions,
  type StrategyDefinition,
  atr,
  and as backtestAnd,
  deadCrossCondition as backtestDeadCross,
  dmiBearish as backtestDmiBearish,
  dmiBullish as backtestDmiBullish,
  goldenCrossCondition as backtestGoldenCross,
  or as backtestOr,
  rsiAbove as backtestRsiAbove,
  rsiBelow as backtestRsiBelow,
  bollingerBands,
  dmi,
  ema,
  incremental,
  macdCrossDown,
  macdCrossUp,
  rsi,
  sma,
  stochastics,
  streaming,
  vwap,
} from "trendcraft";
import { US_MARKET_HOURS } from "../config/market-hours.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
import type { ConditionRef, ConditionRule, IndicatorRef, StrategyTemplate } from "./template.js";
import { isCombined } from "./template.js";

export type CompileResult =
  | { ok: true; strategy: StrategyDefinition }
  | { ok: false; error: string };

/**
 * Compile a StrategyTemplate into an executable StrategyDefinition
 */
export function compileTemplate(template: StrategyTemplate): CompileResult {
  try {
    const pipeline = buildPipeline(template);
    const { backtestEntry, backtestExit, backtestOptions } = buildBacktestConfig(template);

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
        ...(template.guards.timeGuard !== null && {
          timeGuard: US_MARKET_HOURS,
        }),
      },
      position: buildPosition(template),
      ...(signalLifecycle && { signalLifecycle }),
      backtestEntry,
      backtestExit,
      backtestOptions,
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
    case "regime":
      return () =>
        incremental.createRegime({
          atrPeriod: ind.params.atrPeriod ?? 14,
          bbPeriod: ind.params.bbPeriod ?? 20,
          dmiPeriod: ind.params.dmiPeriod ?? 14,
          lookback: ind.params.lookback ?? 100,
        });
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
      const key = resolveIndicatorKey(ref.params?.indicatorKey as string, indicators);
      return buildPriceCondition("above", key, indicators);
    }
    case "priceBelow": {
      const key = resolveIndicatorKey(ref.params?.indicatorKey as string, indicators);
      return buildPriceCondition("below", key, indicators);
    }
    case "smaGoldenCross": {
      const smaInds = indicators.filter((i) => i.type === "sma");
      const sorted = [...smaInds].sort((a, b) => (a.params.period ?? 20) - (b.params.period ?? 20));
      const shortName = sorted[0]?.name ?? "sma20";
      const longName = sorted[1]?.name ?? "sma50";
      return streaming.crossOver(shortName, longName);
    }
    case "smaDeadCross": {
      const smaInds = indicators.filter((i) => i.type === "sma");
      const sorted = [...smaInds].sort((a, b) => (a.params.period ?? 20) - (b.params.period ?? 20));
      const shortName = sorted[0]?.name ?? "sma20";
      const longName = sorted[1]?.name ?? "sma50";
      return streaming.crossUnder(shortName, longName);
    }
    case "emaGoldenCross": {
      const emaInds = indicators.filter((i) => i.type === "ema");
      const sorted = [...emaInds].sort((a, b) => (a.params.period ?? 9) - (b.params.period ?? 9));
      const shortName = sorted[0]?.name ?? "ema10";
      const longName = sorted[1]?.name ?? "ema30";
      return streaming.crossOver(shortName, longName);
    }
    case "emaDeadCross": {
      const emaInds = indicators.filter((i) => i.type === "ema");
      const sorted = [...emaInds].sort((a, b) => (a.params.period ?? 9) - (b.params.period ?? 9));
      const shortName = sorted[0]?.name ?? "ema10";
      const longName = sorted[1]?.name ?? "ema30";
      return streaming.crossUnder(shortName, longName);
    }
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
    case "dmiBullish":
      return streaming.dmiBullish(
        (ref.params?.threshold as number) ?? 25,
        findIndicatorName(indicators, "dmi"),
      );
    case "dmiBearish":
      return streaming.dmiBearish(
        (ref.params?.threshold as number) ?? 25,
        findIndicatorName(indicators, "dmi"),
      );
    case "regimeFilter":
      return streaming.regimeFilter({
        key: ref.params?.key as string | undefined,
        allowedVolatility: ref.params?.allowedVolatility
          ? (String(ref.params.allowedVolatility).split(",") as ("low" | "normal" | "high")[])
          : undefined,
        allowedTrends: ref.params?.allowedTrends
          ? (String(ref.params.allowedTrends).split(",") as ("bullish" | "bearish" | "sideways")[])
          : undefined,
        minTrendStrength: ref.params?.minTrendStrength as number | undefined,
      });
    default:
      throw new Error(`Unknown condition type: ${ref.type}`);
  }
}

function compileStreamingCondition(
  rule: ConditionRule,
  indicators: IndicatorRef[],
): streaming.StreamingCondition {
  if (isCombined(rule)) {
    const compiled = rule.conditions.map((c) => compileStreamingConditionRef(c, indicators));
    return rule.operator === "and" ? streaming.and(...compiled) : streaming.or(...compiled);
  }
  return compileStreamingConditionRef(rule, indicators);
}

// --- Backtest condition compilation ---

function buildBacktestConfig(template: StrategyTemplate) {
  const backtestEntry = compileBacktestCondition(template.entry, template.indicators);
  const backtestExit = compileBacktestCondition(template.exit, template.indicators);

  const backtestOptions = {
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
    commission: template.position.commission ?? DEFAULT_TRADING_COSTS.commission,
    commissionRate: template.position.commissionRate ?? DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: template.position.taxRate ?? DEFAULT_TRADING_COSTS.taxRate,
  };

  return { backtestEntry, backtestExit, backtestOptions };
}

function compileBacktestConditionRef(ref: ConditionRef, indicators: IndicatorRef[]): Condition {
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
      return buildBacktestCustomCondition(ref, indicators);
    case "smaGoldenCross":
      return backtestGoldenCross();
    case "smaDeadCross":
      return backtestDeadCross();
    case "emaGoldenCross": {
      const emaInds = indicators.filter((i) => i.type === "ema");
      const sorted = [...emaInds].sort((a, b) => (a.params.period ?? 9) - (b.params.period ?? 9));
      const shortPeriod = sorted[0]?.params.period ?? 10;
      const longPeriod = sorted[1]?.params.period ?? 30;
      return buildEmaCrossCondition("golden", shortPeriod, longPeriod);
    }
    case "emaDeadCross": {
      const emaInds = indicators.filter((i) => i.type === "ema");
      const sorted = [...emaInds].sort((a, b) => (a.params.period ?? 9) - (b.params.period ?? 9));
      const shortPeriod = sorted[0]?.params.period ?? 10;
      const longPeriod = sorted[1]?.params.period ?? 30;
      return buildEmaCrossCondition("dead", shortPeriod, longPeriod);
    }
    case "dmiBullish": {
      const dmiInd = indicators.find((i) => i.type === "dmi");
      return backtestDmiBullish(
        (ref.params?.threshold as number) ?? 25,
        dmiInd?.params.period ?? 14,
      );
    }
    case "dmiBearish": {
      const dmiInd = indicators.find((i) => i.type === "dmi");
      return backtestDmiBearish(
        (ref.params?.threshold as number) ?? 25,
        dmiInd?.params.period ?? 14,
      );
    }
    default:
      throw new Error(`Unknown backtest condition type: ${ref.type}`);
  }
}

function compileBacktestCondition(rule: ConditionRule, indicators: IndicatorRef[]): Condition {
  if (isCombined(rule)) {
    const compiled = rule.conditions.map((c) => compileBacktestConditionRef(c, indicators));
    return rule.operator === "and" ? backtestAnd(...compiled) : backtestOr(...compiled);
  }
  return compileBacktestConditionRef(rule, indicators);
}

// --- Helpers ---

function findIndicatorName(indicators: IndicatorRef[], type: string): string {
  const found = indicators.find((i) => i.type === type);
  return found?.name ?? type;
}

/**
 * Resolve indicator keys like "bb.lower" into the actual indicator name
 * and sub-field path.
 */
function resolveIndicatorKey(key: string, _indicators: IndicatorRef[]): string {
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
  // Handle VWAP nested value (vwap.vwap)
  const resolveKey = key === "vwap" ? "vwap.vwap" : key;

  // For simple keys without dots, try resolveNumber first (handles both
  // plain numbers and compound objects), falling back to the preset
  if (!key.includes(".") && key !== "vwap") {
    return direction === "above" ? streaming.priceAbove(key) : streaming.priceBelow(key);
  }

  // For dotted keys (e.g. "bb.lower") and vwap, use resolveNumber for type-safe access
  const fn: streaming.StreamingConditionFn = (
    snapshot: streaming.IndicatorSnapshot,
    candle: NormalizedCandle,
  ) => {
    const value = streaming.resolveNumber(snapshot, resolveKey);
    if (value === null) {
      // Fallback: try the original key as a plain number (e.g. vwap stored as number)
      if (key === "vwap") {
        const plain = streaming.getNumber(snapshot, "vwap");
        if (plain === null) return false;
        return direction === "above" ? candle.close > plain : candle.close < plain;
      }
      return false;
    }
    return direction === "above" ? candle.close > value : candle.close < value;
  };
  return fn;
}

/**
 * Compute indicator series on demand and cache in the indicators object.
 * Maps template indicator names (e.g. "sma50", "bb") to trendcraft functions.
 */
function ensureIndicator(
  indicatorCache: Record<string, unknown>,
  indicatorName: string,
  indicatorRefs: IndicatorRef[],
  candles: NormalizedCandle[],
): void {
  if (indicatorCache[indicatorName]) return;

  const ref = indicatorRefs.find((i) => i.name === indicatorName);
  if (!ref) return;

  switch (ref.type) {
    case "sma":
      indicatorCache[indicatorName] = sma(candles, { period: ref.params.period ?? 20 });
      break;
    case "ema":
      indicatorCache[indicatorName] = ema(candles, { period: ref.params.period ?? 9 });
      break;
    case "rsi":
      indicatorCache[indicatorName] = rsi(candles, { period: ref.params.period ?? 14 });
      break;
    case "bollinger":
      indicatorCache[indicatorName] = bollingerBands(candles, {
        period: ref.params.period ?? 20,
        stdDev: ref.params.stdDev ?? 2,
      });
      break;
    case "stochastics":
      indicatorCache[indicatorName] = stochastics(candles, {
        kPeriod: ref.params.kPeriod ?? 14,
        dPeriod: ref.params.dPeriod ?? 3,
      });
      break;
    case "atr":
      indicatorCache[indicatorName] = atr(candles, { period: ref.params.period ?? 14 });
      break;
    case "dmi":
      indicatorCache[indicatorName] = dmi(candles, { period: ref.params.period ?? 14 });
      break;
    case "vwap":
      indicatorCache[indicatorName] = vwap(candles);
      break;
  }
}

/**
 * Build custom backtest condition for price/indicator comparisons.
 * Computes indicators on demand from template IndicatorRef definitions.
 */
function buildBacktestCustomCondition(ref: ConditionRef, indicatorRefs: IndicatorRef[]): Condition {
  const key = ref.params?.indicatorKey as string;
  const threshold = ref.params?.threshold as number | undefined;

  return (indicators, candle, index, candles) => {
    const parts = key?.split(".") ?? [];
    let value: number | null = null;

    const indicatorName = parts[0];
    if (!indicatorName) return false;

    // Ensure the indicator is computed
    ensureIndicator(indicators, indicatorName, indicatorRefs, candles);

    if (parts.length === 2) {
      // e.g., "bb.lower"
      const series = indicators[indicatorName] as
        | { time: number; value: Record<string, number> }[]
        | undefined;
      if (series) {
        const entry = series[index];
        if (entry?.value) value = entry.value[parts[1]] ?? null;
      }
    } else {
      const series = indicators[indicatorName] as { time: number; value: unknown }[] | undefined;
      if (series) {
        const entry = series[index];
        if (entry) {
          if (typeof entry.value === "number") {
            value = entry.value;
          } else if (entry.value && typeof entry.value === "object") {
            const obj = entry.value as Record<string, unknown>;
            if ("vwap" in obj) {
              value = (obj.vwap as number) ?? null;
            } else if ("k" in obj) {
              value = (obj.k as number) ?? null;
            } else if ("adx" in obj) {
              value = (obj.adx as number) ?? null;
            } else if ("middle" in obj) {
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

/**
 * Build an EMA cross backtest condition (golden or dead)
 */
function buildEmaCrossCondition(
  direction: "golden" | "dead",
  shortPeriod: number,
  longPeriod: number,
): Condition {
  return (indicators, _candle, index, candles) => {
    if (index < 1) return false;

    const shortKey = `ema${shortPeriod}`;
    const longKey = `ema${longPeriod}`;

    if (!indicators[shortKey]) {
      indicators[shortKey] = ema(candles, { period: shortPeriod });
    }
    if (!indicators[longKey]) {
      indicators[longKey] = ema(candles, { period: longPeriod });
    }

    const shortEma = indicators[shortKey] as { time: number; value: number | null }[];
    const longEma = indicators[longKey] as { time: number; value: number | null }[];

    const currShort = shortEma[index]?.value;
    const currLong = longEma[index]?.value;
    const prevShort = shortEma[index - 1]?.value;
    const prevLong = longEma[index - 1]?.value;

    if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
      return false;
    }

    if (direction === "golden") {
      return prevShort <= prevLong && currShort > currLong;
    }
    return prevShort >= prevLong && currShort < currLong;
  };
}

function buildSignalLifecycle(template: StrategyTemplate): SignalManagerOptions | undefined {
  const lc = template.signalLifecycle;
  if (!lc) return undefined;
  if (!lc.cooldownBars && !lc.debounceBars && !lc.expiryBars) return undefined;

  return {
    ...(lc.cooldownBars && { cooldown: { bars: lc.cooldownBars } }),
    ...(lc.debounceBars && { debounce: { bars: lc.debounceBars } }),
    ...(lc.expiryBars && { expiry: { bars: lc.expiryBars } }),
  };
}

function buildPosition(template: StrategyTemplate): streaming.PositionManagerOptions {
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
    commission: template.position.commission ?? DEFAULT_TRADING_COSTS.commission,
    commissionRate: template.position.commissionRate ?? DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: template.position.taxRate ?? DEFAULT_TRADING_COSTS.taxRate,
  };
}
