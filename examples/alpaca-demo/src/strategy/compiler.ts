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
  keltnerChannel,
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
      ...(template.backtestTimeframe && {
        metadata: {
          backtestTimeframe: template.backtestTimeframe,
          backtestPeriodDays: template.backtestPeriodDays,
        },
      }),
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
    case "keltner":
      return () =>
        incremental.createKeltnerChannel({
          emaPeriod: ind.params.period ?? 20,
          atrPeriod: ind.params.period ?? 20,
          multiplier: ind.params.multiplier ?? 2,
        });
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
    case "smaGoldenCross":
    case "smaDeadCross": {
      const [shortName, longName] = sortedIndicatorPair(indicators, "sma", 20, "sma20", "sma50");
      return ref.type === "smaGoldenCross"
        ? streaming.crossOver(shortName, longName)
        : streaming.crossUnder(shortName, longName);
    }
    case "emaGoldenCross":
    case "emaDeadCross": {
      const [shortName, longName] = sortedIndicatorPair(indicators, "ema", 9, "ema10", "ema30");
      return ref.type === "emaGoldenCross"
        ? streaming.crossOver(shortName, longName)
        : streaming.crossUnder(shortName, longName);
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
    case "priceBelowVwap":
      return priceVsField(indicators, "vwap", "vwap", "below");
    case "priceAboveVwap":
      return priceVsField(indicators, "vwap", "vwap", "above");
    case "priceBelowKeltnerLower":
      return priceVsField(indicators, "keltner", "lower", "below");
    case "priceAboveKeltnerMiddle":
      return priceVsField(indicators, "keltner", "middle", "above");
    case "emaCrossUp":
    case "emaCrossDown": {
      const [shortName, longName] = sortedIndicatorPair(indicators, "ema", 9, "ema8", "ema21");
      return ref.type === "emaCrossUp"
        ? streaming.crossOver(shortName, longName)
        : streaming.crossUnder(shortName, longName);
    }
    case "stochOversoldCrossUp": {
      const stochName = findIndicatorName(indicators, "stochastics");
      const threshold = (ref.params?.threshold as number) ?? 20;
      const crossUp = streaming.crossOver(
        (snapshot) => streaming.getField(snapshot, stochName, "k"),
        (snapshot) => streaming.getField(snapshot, stochName, "d"),
      );
      const fn: streaming.StreamingConditionFn = (snapshot, candle) => {
        const k = streaming.getField(snapshot, stochName, "k");
        if (k === null || k >= threshold) return false;
        return crossUp.evaluate(snapshot, candle);
      };
      return fn;
    }
    case "stochOverbought": {
      const stochName = findIndicatorName(indicators, "stochastics");
      const threshold = (ref.params?.threshold as number) ?? 80;
      const fn: streaming.StreamingConditionFn = (snapshot) => {
        const k = streaming.getField(snapshot, stochName, "k");
        if (k === null) return false;
        return k > threshold;
      };
      return fn;
    }
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
    case "emaGoldenCross":
    case "emaDeadCross": {
      const [shortP, longP] = sortedIndicatorPeriods(indicators, "ema", 9, 10, 30);
      return buildEmaCrossCondition(
        ref.type === "emaGoldenCross" ? "golden" : "dead",
        shortP,
        longP,
      );
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
    case "priceBelowVwap":
      return buildBacktestBandCondition("vwap", "vwap", "below", indicators);
    case "priceAboveVwap":
      return buildBacktestBandCondition("vwap", "vwap", "above", indicators);
    case "priceBelowKeltnerLower":
      return buildBacktestBandCondition("keltner", "lower", "below", indicators);
    case "priceAboveKeltnerMiddle":
      return buildBacktestBandCondition("keltner", "middle", "above", indicators);
    case "emaCrossUp":
    case "emaCrossDown": {
      const [shortP, longP] = sortedIndicatorPeriods(indicators, "ema", 9, 8, 21);
      return buildEmaCrossCondition(ref.type === "emaCrossUp" ? "golden" : "dead", shortP, longP);
    }
    case "stochOversoldCrossUp":
      return buildBacktestStochCrossUp((ref.params?.threshold as number) ?? 20, indicators);
    case "stochOverbought":
      return buildBacktestStochOverbought((ref.params?.threshold as number) ?? 80, indicators);
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
 * Sort indicators of a given type by period and return the short/long names.
 * Falls back to the provided defaults when fewer than 2 indicators are found.
 */
function sortedIndicatorPair(
  indicators: IndicatorRef[],
  type: string,
  defaultPeriod: number,
  defaultShort: string,
  defaultLong: string,
): [string, string] {
  const filtered = indicators.filter((i) => i.type === type);
  const sorted = [...filtered].sort(
    (a, b) => (a.params.period ?? defaultPeriod) - (b.params.period ?? defaultPeriod),
  );
  return [sorted[0]?.name ?? defaultShort, sorted[1]?.name ?? defaultLong];
}

/**
 * Sort indicators of a given type by period and return the short/long periods.
 * Used by backtest EMA cross conditions that need numeric periods rather than names.
 */
function sortedIndicatorPeriods(
  indicators: IndicatorRef[],
  type: string,
  defaultPeriod: number,
  defaultShort: number,
  defaultLong: number,
): [number, number] {
  const filtered = indicators.filter((i) => i.type === type);
  const sorted = [...filtered].sort(
    (a, b) => (a.params.period ?? defaultPeriod) - (b.params.period ?? defaultPeriod),
  );
  return [sorted[0]?.params.period ?? defaultShort, sorted[1]?.params.period ?? defaultLong];
}

/**
 * Build a streaming condition that compares candle.close against a sub-field
 * of a compound indicator (e.g. vwap.vwap, keltner.lower).
 */
function priceVsField(
  indicators: IndicatorRef[],
  indicatorType: string,
  field: string,
  direction: "above" | "below",
): streaming.StreamingConditionFn {
  const name = findIndicatorName(indicators, indicatorType);
  return (snapshot, candle) => {
    const v = streaming.resolveNumber(snapshot, `${name}.${field}`);
    if (v === null) return false;
    return direction === "above" ? candle.close > v : candle.close < v;
  };
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
    case "keltner":
      indicatorCache[indicatorName] = keltnerChannel(candles, {
        emaPeriod: ref.params.period ?? 20,
        atrPeriod: ref.params.period ?? 20,
        multiplier: ref.params.multiplier ?? 2,
      });
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

/**
 * Build a backtest condition that compares candle.close against a sub-field
 * of a compound indicator (e.g. vwap.vwap, keltner.lower).
 */
function buildBacktestBandCondition(
  indicatorType: string,
  field: string,
  direction: "above" | "below",
  indicatorRefs: IndicatorRef[],
): Condition {
  return (indicators, candle, index, candles) => {
    const name = findIndicatorName(indicatorRefs, indicatorType);
    ensureIndicator(indicators, name, indicatorRefs, candles);
    const series = indicators[name] as
      | { time: number; value: Record<string, number | null> }[]
      | undefined;
    const v = series?.[index]?.value?.[field];
    if (v === null || v === undefined) return false;
    return direction === "above" ? candle.close > v : candle.close < v;
  };
}

/**
 * Resolve stochastic series from the backtest indicator cache
 */
function resolveStochSeries(
  indicators: Record<string, unknown>,
  indicatorRefs: IndicatorRef[],
  candles: NormalizedCandle[],
): { time: number; value: { k: number | null; d: number | null } }[] | undefined {
  const name = findIndicatorName(indicatorRefs, "stochastics");
  ensureIndicator(indicators, name, indicatorRefs, candles);
  return indicators[name] as
    | { time: number; value: { k: number | null; d: number | null } }[]
    | undefined;
}

/**
 * Build a backtest condition for Stochastic oversold K crosses above D
 */
function buildBacktestStochCrossUp(threshold: number, indicatorRefs: IndicatorRef[]): Condition {
  return (indicators, _candle, index, candles) => {
    if (index < 1) return false;
    const series = resolveStochSeries(indicators, indicatorRefs, candles);
    if (!series) return false;
    const curr = series[index]?.value;
    const prev = series[index - 1]?.value;
    if (!curr?.k || !curr?.d || !prev?.k || !prev?.d) return false;
    // K crosses above D while K is below threshold (oversold)
    return curr.k < threshold && prev.k <= prev.d && curr.k > curr.d;
  };
}

/**
 * Build a backtest condition for Stochastic overbought
 */
function buildBacktestStochOverbought(threshold: number, indicatorRefs: IndicatorRef[]): Condition {
  return (indicators, _candle, index, candles) => {
    const series = resolveStochSeries(indicators, indicatorRefs, candles);
    const k = series?.[index]?.value?.k;
    if (k === null || k === undefined) return false;
    return k > threshold;
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
