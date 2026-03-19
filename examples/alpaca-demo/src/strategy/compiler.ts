/**
 * Template Compiler — converts StrategyTemplate to StrategyDefinition
 *
 * Uses registry-based approach (no eval). Indicator and condition types are
 * registered once and used for both streaming and backtest compilation.
 */

import {
  type Condition,
  type NormalizedCandle,
  type SignalManagerOptions,
  type StrategyDefinition,
  aroon,
  atr,
  adxStrong as backtestAdxStrong,
  and as backtestAnd,
  atrPercentAbove as backtestAtrPercentAbove,
  atrPercentBelow as backtestAtrPercentBelow,
  bollingerBreakout as backtestBollingerBreakout,
  bollingerTouch as backtestBollingerTouch,
  cmfAbove as backtestCmfAbove,
  cmfBelow as backtestCmfBelow,
  deadCrossCondition as backtestDeadCross,
  dmiBearish as backtestDmiBearish,
  dmiBullish as backtestDmiBullish,
  goldenCrossCondition as backtestGoldenCross,
  liquiditySweepRecovered as backtestLiquiditySweepRecovered,
  obvFalling as backtestObvFalling,
  obvRising as backtestObvRising,
  or as backtestOr,
  priceAtBullishOrderBlock as backtestPriceAtBullishOB,
  rsiAbove as backtestRsiAbove,
  rsiBelow as backtestRsiBelow,
  stochAbove as backtestStochAbove,
  stochBelow as backtestStochBelow,
  stochCrossDown as backtestStochCrossDown,
  stochCrossUp as backtestStochCrossUp,
  volatilityContracting as backtestVolatilityContracting,
  volatilityExpanding as backtestVolatilityExpanding,
  volumeAboveAvg as backtestVolumeAboveAvg,
  bollingerBands,
  cmf,
  cmo,
  connorsRsi,
  dmi,
  ema,
  hma,
  incremental,
  kama,
  keltnerChannel,
  liquiditySweep,
  macdCrossDown,
  macdCrossUp,
  obv,
  orderBlock,
  rsi,
  sma,
  stochastics,
  streaming,
  supertrend,
  t3,
  trix,
  vortex,
  vwap,
  vwma,
} from "trendcraft";
import { US_MARKET_HOURS } from "../config/market-hours.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
import type {
  ConditionRef,
  ConditionRule,
  IndicatorRef,
  RegimeGate,
  StrategyTemplate,
} from "./template.js";
import { isCombined } from "./template.js";

export type CompileResult =
  | { ok: true; strategy: StrategyDefinition }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Indicator Registry — single source of truth for both incremental & batch
// ---------------------------------------------------------------------------

type IncrementalFactory = () => incremental.IncrementalIndicator<unknown>;

type IndicatorDef = {
  createIncremental: (params: Record<string, number>) => IncrementalFactory;
  computeBatch: (candles: NormalizedCandle[], params: Record<string, number>) => unknown;
};

const INDICATOR_REGISTRY: Record<string, IndicatorDef> = {
  rsi: {
    createIncremental: (p) => () => incremental.createRsi({ period: p.period ?? 14 }),
    computeBatch: (c, p) => rsi(c, { period: p.period ?? 14 }),
  },
  macd: {
    createIncremental: (p) => () =>
      incremental.createMacd({
        fastPeriod: p.fastPeriod ?? 12,
        slowPeriod: p.slowPeriod ?? 26,
        signalPeriod: p.signalPeriod ?? 9,
      }),
    computeBatch: (c, p) =>
      // macd batch is computed on-demand via custom condition; not used directly
      null,
  },
  bollinger: {
    createIncremental: (p) => () =>
      incremental.createBollingerBands({ period: p.period ?? 20, stdDev: p.stdDev ?? 2 }),
    computeBatch: (c, p) => bollingerBands(c, { period: p.period ?? 20, stdDev: p.stdDev ?? 2 }),
  },
  ema: {
    createIncremental: (p) => () => incremental.createEma({ period: p.period ?? 9 }),
    computeBatch: (c, p) => ema(c, { period: p.period ?? 9 }),
  },
  sma: {
    createIncremental: (p) => () => incremental.createSma({ period: p.period ?? 20 }),
    computeBatch: (c, p) => sma(c, { period: p.period ?? 20 }),
  },
  vwap: {
    createIncremental: (_p) => () => incremental.createVwap(),
    computeBatch: (c, _p) => vwap(c),
  },
  atr: {
    createIncremental: (p) => () => incremental.createAtr({ period: p.period ?? 14 }),
    computeBatch: (c, p) => atr(c, { period: p.period ?? 14 }),
  },
  stochastics: {
    createIncremental: (p) => () =>
      incremental.createStochastics({ kPeriod: p.kPeriod ?? 14, dPeriod: p.dPeriod ?? 3 }),
    computeBatch: (c, p) => stochastics(c, { kPeriod: p.kPeriod ?? 14, dPeriod: p.dPeriod ?? 3 }),
  },
  dmi: {
    createIncremental: (p) => () => incremental.createDmi({ period: p.period ?? 14 }),
    computeBatch: (c, p) => dmi(c, { period: p.period ?? 14 }),
  },
  keltner: {
    createIncremental: (p) => () =>
      incremental.createKeltnerChannel({
        emaPeriod: p.period ?? 20,
        atrPeriod: p.period ?? 20,
        multiplier: p.multiplier ?? 2,
      }),
    computeBatch: (c, p) =>
      keltnerChannel(c, {
        emaPeriod: p.period ?? 20,
        atrPeriod: p.period ?? 20,
        multiplier: p.multiplier ?? 2,
      }),
  },
  regime: {
    createIncremental: (p) => () =>
      incremental.createRegime({
        atrPeriod: p.atrPeriod ?? 14,
        bbPeriod: p.bbPeriod ?? 20,
        dmiPeriod: p.dmiPeriod ?? 14,
        lookback: p.lookback ?? 100,
      }),
    computeBatch: (_c, _p) => null, // regime is streaming-only
  },
  hma: {
    createIncremental: (p) => () => incremental.createHma({ period: p.period ?? 9 }),
    computeBatch: (c, p) => hma(c, { period: p.period ?? 9 }),
  },
  kama: {
    createIncremental: (p) => () =>
      incremental.createKama({
        period: p.period ?? 10,
        fastPeriod: p.fastPeriod ?? 2,
        slowPeriod: p.slowPeriod ?? 30,
      }),
    computeBatch: (c, p) =>
      kama(c, {
        period: p.period ?? 10,
        fastPeriod: p.fastPeriod ?? 2,
        slowPeriod: p.slowPeriod ?? 30,
      }),
  },
  t3: {
    createIncremental: (p) => () =>
      incremental.createT3({ period: p.period ?? 5, vFactor: p.vFactor ?? 0.7 }),
    computeBatch: (c, p) => t3(c, { period: p.period ?? 5, vFactor: p.vFactor ?? 0.7 }),
  },
  vwma: {
    createIncremental: (p) => () => incremental.createVwma({ period: p.period ?? 20 }),
    computeBatch: (c, p) => vwma(c, { period: p.period ?? 20 }),
  },
  connorsRsi: {
    createIncremental: (p) => () =>
      incremental.createConnorsRsi({
        rsiPeriod: p.rsiPeriod ?? 3,
        streakPeriod: p.streakPeriod ?? 2,
        rocPeriod: p.rocPeriod ?? 100,
      }),
    computeBatch: (c, p) =>
      connorsRsi(c, {
        rsiPeriod: p.rsiPeriod ?? 3,
        streakPeriod: p.streakPeriod ?? 2,
        rocPeriod: p.rocPeriod ?? 100,
      }),
  },
  trix: {
    createIncremental: (p) => () =>
      incremental.createTrix({ period: p.period ?? 15, signalPeriod: p.signalPeriod ?? 9 }),
    computeBatch: (c, p) => trix(c, { period: p.period ?? 15, signalPeriod: p.signalPeriod ?? 9 }),
  },
  aroon: {
    createIncremental: (p) => () => incremental.createAroon({ period: p.period ?? 25 }),
    computeBatch: (c, p) => aroon(c, { period: p.period ?? 25 }),
  },
  vortexIndicator: {
    createIncremental: (p) => () => incremental.createVortex({ period: p.period ?? 14 }),
    computeBatch: (c, p) => vortex(c, { period: p.period ?? 14 }),
  },
  cmo: {
    createIncremental: (p) => () => incremental.createCmo({ period: p.period ?? 14 }),
    computeBatch: (c, p) => cmo(c, { period: p.period ?? 14 }),
  },
  obv: {
    createIncremental: (_p) => () => incremental.createObv(),
    computeBatch: (c, _p) => obv(c),
  },
  cmfIndicator: {
    createIncremental: (p) => () => incremental.createCmf({ period: p.period ?? 20 }),
    computeBatch: (c, p) => cmf(c, { period: p.period ?? 20 }),
  },
  supertrend: {
    createIncremental: (p) => () =>
      incremental.createSupertrend({ period: p.period ?? 10, multiplier: p.multiplier ?? 3 }),
    computeBatch: (c, p) =>
      supertrend(c, { period: p.period ?? 10, multiplier: p.multiplier ?? 3 }),
  },
};

// ---------------------------------------------------------------------------
// Condition Registry — single source of truth for streaming & backtest
// ---------------------------------------------------------------------------

type ConditionDef = {
  streaming: (ref: ConditionRef, indicators: IndicatorRef[]) => streaming.StreamingCondition;
  backtest: (ref: ConditionRef, indicators: IndicatorRef[]) => Condition;
};

const CONDITION_REGISTRY: Record<string, ConditionDef> = {
  rsiBelow: {
    streaming: (ref, inds) =>
      streaming.rsiBelow((ref.params?.threshold as number) ?? 30, findIndicatorName(inds, "rsi")),
    backtest: (ref, _inds) => backtestRsiBelow((ref.params?.threshold as number) ?? 30),
  },
  rsiAbove: {
    streaming: (ref, inds) =>
      streaming.rsiAbove((ref.params?.threshold as number) ?? 70, findIndicatorName(inds, "rsi")),
    backtest: (ref, _inds) => backtestRsiAbove((ref.params?.threshold as number) ?? 70),
  },
  macdPositive: {
    streaming: (_ref, inds) => streaming.macdPositive(findIndicatorName(inds, "macd")),
    backtest: (_ref, inds) => {
      const m = inds.find((i) => i.type === "macd");
      return macdCrossUp(
        m?.params.fastPeriod ?? 12,
        m?.params.slowPeriod ?? 26,
        m?.params.signalPeriod ?? 9,
      );
    },
  },
  macdNegative: {
    streaming: (_ref, inds) => streaming.macdNegative(findIndicatorName(inds, "macd")),
    backtest: (_ref, inds) => {
      const m = inds.find((i) => i.type === "macd");
      return macdCrossDown(
        m?.params.fastPeriod ?? 12,
        m?.params.slowPeriod ?? 26,
        m?.params.signalPeriod ?? 9,
      );
    },
  },
  priceAbove: {
    streaming: (ref, inds) =>
      buildPriceCondition("above", ref.params?.indicatorKey as string, inds),
    backtest: (ref, inds) => buildBacktestCustomCondition(ref, inds),
  },
  priceBelow: {
    streaming: (ref, inds) =>
      buildPriceCondition("below", ref.params?.indicatorKey as string, inds),
    backtest: (ref, inds) => buildBacktestCustomCondition(ref, inds),
  },
  smaGoldenCross: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "sma", 20, "sma20", "sma50");
      return streaming.crossOver(s, l);
    },
    backtest: () => backtestGoldenCross(),
  },
  smaDeadCross: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "sma", 20, "sma20", "sma50");
      return streaming.crossUnder(s, l);
    },
    backtest: () => backtestDeadCross(),
  },
  emaGoldenCross: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "ema", 9, "ema10", "ema30");
      return streaming.crossOver(s, l);
    },
    backtest: (_ref, inds) => {
      const [sp, lp] = sortedIndicatorPeriods(inds, "ema", 9, 10, 30);
      return buildEmaCrossCondition("golden", sp, lp);
    },
  },
  emaDeadCross: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "ema", 9, "ema10", "ema30");
      return streaming.crossUnder(s, l);
    },
    backtest: (_ref, inds) => {
      const [sp, lp] = sortedIndicatorPeriods(inds, "ema", 9, 10, 30);
      return buildEmaCrossCondition("dead", sp, lp);
    },
  },
  indicatorAbove: {
    streaming: (ref, _inds) =>
      streaming.indicatorAbove(
        ref.params?.indicatorKey as string,
        (ref.params?.threshold as number) ?? 0,
      ),
    backtest: (ref, inds) => buildBacktestCustomCondition(ref, inds),
  },
  indicatorBelow: {
    streaming: (ref, _inds) =>
      streaming.indicatorBelow(
        ref.params?.indicatorKey as string,
        (ref.params?.threshold as number) ?? 0,
      ),
    backtest: (ref, inds) => buildBacktestCustomCondition(ref, inds),
  },
  dmiBullish: {
    streaming: (ref, inds) =>
      streaming.dmiBullish((ref.params?.threshold as number) ?? 25, findIndicatorName(inds, "dmi")),
    backtest: (ref, inds) => {
      const d = inds.find((i) => i.type === "dmi");
      return backtestDmiBullish((ref.params?.threshold as number) ?? 25, d?.params.period ?? 14);
    },
  },
  dmiBearish: {
    streaming: (ref, inds) =>
      streaming.dmiBearish((ref.params?.threshold as number) ?? 25, findIndicatorName(inds, "dmi")),
    backtest: (ref, inds) => {
      const d = inds.find((i) => i.type === "dmi");
      return backtestDmiBearish((ref.params?.threshold as number) ?? 25, d?.params.period ?? 14);
    },
  },
  priceBelowVwap: {
    streaming: (_ref, inds) => priceVsField(inds, "vwap", "vwap", "below"),
    backtest: (_ref, inds) => buildBacktestBandCondition("vwap", "vwap", "below", inds),
  },
  priceAboveVwap: {
    streaming: (_ref, inds) => priceVsField(inds, "vwap", "vwap", "above"),
    backtest: (_ref, inds) => buildBacktestBandCondition("vwap", "vwap", "above", inds),
  },
  priceBelowKeltnerLower: {
    streaming: (_ref, inds) => priceVsField(inds, "keltner", "lower", "below"),
    backtest: (_ref, inds) => buildBacktestBandCondition("keltner", "lower", "below", inds),
  },
  priceAboveKeltnerMiddle: {
    streaming: (_ref, inds) => priceVsField(inds, "keltner", "middle", "above"),
    backtest: (_ref, inds) => buildBacktestBandCondition("keltner", "middle", "above", inds),
  },
  emaCrossUp: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "ema", 9, "ema8", "ema21");
      return streaming.crossOver(s, l);
    },
    backtest: (_ref, inds) => {
      const [sp, lp] = sortedIndicatorPeriods(inds, "ema", 9, 8, 21);
      return buildEmaCrossCondition("golden", sp, lp);
    },
  },
  emaCrossDown: {
    streaming: (_ref, inds) => {
      const [s, l] = sortedIndicatorPair(inds, "ema", 9, "ema8", "ema21");
      return streaming.crossUnder(s, l);
    },
    backtest: (_ref, inds) => {
      const [sp, lp] = sortedIndicatorPeriods(inds, "ema", 9, 8, 21);
      return buildEmaCrossCondition("dead", sp, lp);
    },
  },
  stochOversoldCrossUp: {
    streaming: (ref, inds) => {
      const stochName = findIndicatorName(inds, "stochastics");
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
    },
    backtest: (ref, inds) =>
      buildBacktestStochCrossUp((ref.params?.threshold as number) ?? 20, inds),
  },
  stochOverbought: {
    streaming: (ref, inds) => {
      const stochName = findIndicatorName(inds, "stochastics");
      const threshold = (ref.params?.threshold as number) ?? 80;
      const fn: streaming.StreamingConditionFn = (snapshot) => {
        const k = streaming.getField(snapshot, stochName, "k");
        if (k === null) return false;
        return k > threshold;
      };
      return fn;
    },
    backtest: (ref, inds) =>
      buildBacktestStochOverbought((ref.params?.threshold as number) ?? 80, inds),
  },
  priceBelowVwapLowerBand: {
    streaming: (_ref, inds) => {
      const name = findIndicatorName(inds, "vwap");
      const fn: streaming.StreamingConditionFn = (snapshot, candle) => {
        const vwapVal = streaming.resolveNumber(snapshot, `${name}.vwap`);
        if (vwapVal === null) {
          const plain = streaming.getNumber(snapshot, name);
          if (plain === null) return false;
          return candle.close < plain * 0.99; // ~1σ below VWAP
        }
        return candle.close < vwapVal * 0.99;
      };
      return fn;
    },
    backtest: (_ref, inds) => buildBacktestBandCondition("vwap", "lower", "below", inds),
  },
  priceAboveVwapUpperBand: {
    streaming: (_ref, inds) => {
      const name = findIndicatorName(inds, "vwap");
      const fn: streaming.StreamingConditionFn = (snapshot, candle) => {
        const vwapVal = streaming.resolveNumber(snapshot, `${name}.vwap`);
        if (vwapVal === null) {
          const plain = streaming.getNumber(snapshot, name);
          if (plain === null) return false;
          return candle.close > plain * 1.01; // ~1σ above VWAP
        }
        return candle.close > vwapVal * 1.01;
      };
      return fn;
    },
    backtest: (_ref, inds) => buildBacktestBandCondition("vwap", "upper", "above", inds),
  },
  gapDown: {
    streaming: (ref, _inds) => {
      const minGapPct = (ref.params?.minGapPercent as number) ?? 1;
      // Closure state is safe: each agent gets its own compileTemplate() call
      let prevClose: number | null = null;
      const fn: streaming.StreamingConditionFn = (_snapshot, candle) => {
        if (prevClose === null) {
          prevClose = candle.close;
          return false;
        }
        const gapPct = ((candle.open - prevClose) / prevClose) * 100;
        prevClose = candle.close;
        return gapPct <= -minGapPct;
      };
      return fn;
    },
    backtest: (ref, _inds) => {
      const minGapPct = (ref.params?.minGapPercent as number) ?? 1;
      return (_indicators, candle, index, candles) => {
        if (index < 1) return false;
        const prevClose = candles[index - 1].close;
        const gapPct = ((candle.open - prevClose) / prevClose) * 100;
        return gapPct <= -minGapPct;
      };
    },
  },
  gapUp: {
    streaming: (ref, _inds) => {
      const minGapPct = (ref.params?.minGapPercent as number) ?? 1;
      // Closure state is safe: each agent gets its own compileTemplate() call
      let prevClose: number | null = null;
      const fn: streaming.StreamingConditionFn = (_snapshot, candle) => {
        if (prevClose === null) {
          prevClose = candle.close;
          return false;
        }
        const gapPct = ((candle.open - prevClose) / prevClose) * 100;
        prevClose = candle.close;
        return gapPct >= minGapPct;
      };
      return fn;
    },
    backtest: (ref, _inds) => {
      const minGapPct = (ref.params?.minGapPercent as number) ?? 1;
      return (_indicators, candle, index, candles) => {
        if (index < 1) return false;
        const prevClose = candles[index - 1].close;
        const gapPct = ((candle.open - prevClose) / prevClose) * 100;
        return gapPct >= minGapPct;
      };
    },
  },
  priceAtBullishOB: {
    streaming: (_ref, _inds) => {
      // Rolling window OB detection for streaming
      const buffer: NormalizedCandle[] = [];
      const maxBuffer = 100;
      const fn: streaming.StreamingConditionFn = (_snapshot, candle) => {
        buffer.push(candle);
        if (buffer.length > maxBuffer) buffer.shift();
        if (buffer.length < 20) return false;
        // Recompute every 10 bars to limit overhead
        if (buffer.length % 10 !== 0) return false;
        try {
          const obData = orderBlock(buffer);
          const last = obData[obData.length - 1]?.value;
          return last?.atBullishOB ?? false;
        } catch {
          return false;
        }
      };
      return fn;
    },
    backtest: (_ref, _inds) => backtestPriceAtBullishOB(),
  },
  liquiditySweepRecovered: {
    streaming: (ref, _inds) => {
      const sweepType = (ref.params?.type as "bullish" | "bearish" | undefined) ?? "bullish";
      const buffer: NormalizedCandle[] = [];
      const maxBuffer = 100;
      const fn: streaming.StreamingConditionFn = (_snapshot, candle) => {
        buffer.push(candle);
        if (buffer.length > maxBuffer) buffer.shift();
        if (buffer.length < 20) return false;
        if (buffer.length % 10 !== 0) return false;
        try {
          const sweepData = liquiditySweep(buffer);
          const last = sweepData[sweepData.length - 1]?.value;
          if (!last?.recoveredThisBar.length) return false;
          return last.recoveredThisBar.some((s) => s.type === sweepType);
        } catch {
          return false;
        }
      };
      return fn;
    },
    backtest: (ref, _inds) => {
      const sweepType = (ref.params?.type as "bullish" | "bearish" | undefined) ?? "bullish";
      return backtestLiquiditySweepRecovered(sweepType);
    },
  },
  mtfPriceAbove: {
    streaming: (ref, _inds) => {
      const indicatorKey = ref.params?.indicatorKey as string;
      const timeframeKey = (ref.params?.timeframe as string) ?? "15m";
      const fn: streaming.StreamingConditionFn = (snapshot, candle) => {
        const mtf = snapshot[`mtf_${timeframeKey}`] as Record<string, unknown> | undefined;
        if (!mtf) return false;
        const value = mtf[indicatorKey];
        if (typeof value !== "number") return false;
        return candle.close > value;
      };
      return fn;
    },
    backtest: (_ref, _inds) => () => true, // MTF is streaming-only
  },
  mtfTrendBullish: {
    streaming: (ref, _inds) => {
      const timeframeKey = (ref.params?.timeframe as string) ?? "15m";
      const fn: streaming.StreamingConditionFn = (snapshot, _candle) => {
        const mtf = snapshot[`mtf_${timeframeKey}`] as Record<string, unknown> | undefined;
        if (!mtf) return false;
        // Check if regime shows bullish trend
        const regime = mtf.regime as Record<string, unknown> | undefined;
        if (regime) {
          return regime.trend === "bullish";
        }
        // Fallback: check if EMA is rising (price > ema value)
        return false;
      };
      return fn;
    },
    backtest: (_ref, _inds) => () => true, // MTF is streaming-only
  },
  regimeFilter: {
    streaming: (ref, _inds) =>
      streaming.regimeFilter({
        key: ref.params?.key as string | undefined,
        allowedVolatility: ref.params?.allowedVolatility
          ? (String(ref.params.allowedVolatility).split(",") as ("low" | "normal" | "high")[])
          : undefined,
        allowedTrends: ref.params?.allowedTrends
          ? (String(ref.params.allowedTrends).split(",") as ("bullish" | "bearish" | "sideways")[])
          : undefined,
        minTrendStrength: ref.params?.minTrendStrength as number | undefined,
      }),
    backtest: (_ref, _inds) => {
      // regimeFilter is streaming-only; always pass in backtest
      return () => true;
    },
  },
  // --- Bollinger Bands conditions ---
  bollingerUpperTouch: {
    streaming: (_ref, inds) =>
      streaming.bollingerTouch("upper", 0.1, findIndicatorName(inds, "bollinger")),
    backtest: (_ref, _inds) => backtestBollingerTouch("upper"),
  },
  bollingerLowerTouch: {
    streaming: (_ref, inds) =>
      streaming.bollingerTouch("lower", 0.1, findIndicatorName(inds, "bollinger")),
    backtest: (_ref, _inds) => backtestBollingerTouch("lower"),
  },
  bollingerBreakoutUp: {
    streaming: (_ref, inds) =>
      streaming.bollingerBreakout("upper", findIndicatorName(inds, "bollinger")),
    backtest: (_ref, _inds) => backtestBollingerBreakout("upper"),
  },
  priceAboveBollingerMiddle: {
    streaming: (_ref, inds) => priceVsField(inds, "bollinger", "middle", "above"),
    backtest: (_ref, inds) => buildBacktestBandCondition("bollinger", "middle", "above", inds),
  },
  priceBelowBollingerMiddle: {
    streaming: (_ref, inds) => priceVsField(inds, "bollinger", "middle", "below"),
    backtest: (_ref, inds) => buildBacktestBandCondition("bollinger", "middle", "below", inds),
  },
  // --- Stochastic conditions ---
  stochBelow: {
    streaming: (ref, inds) =>
      streaming.stochBelow(
        (ref.params?.threshold as number) ?? 20,
        findIndicatorName(inds, "stochastics"),
      ),
    backtest: (ref, inds) => {
      const s = inds.find((i) => i.type === "stochastics");
      return backtestStochBelow(
        (ref.params?.threshold as number) ?? 20,
        s?.params.kPeriod ?? 14,
        s?.params.dPeriod ?? 3,
      );
    },
  },
  stochAbove: {
    streaming: (ref, inds) =>
      streaming.stochAbove(
        (ref.params?.threshold as number) ?? 80,
        findIndicatorName(inds, "stochastics"),
      ),
    backtest: (ref, inds) => {
      const s = inds.find((i) => i.type === "stochastics");
      return backtestStochAbove(
        (ref.params?.threshold as number) ?? 80,
        s?.params.kPeriod ?? 14,
        s?.params.dPeriod ?? 3,
      );
    },
  },
  stochCrossDown: {
    streaming: (_ref, inds) => streaming.stochCrossDown(findIndicatorName(inds, "stochastics")),
    backtest: (_ref, inds) => {
      const s = inds.find((i) => i.type === "stochastics");
      return backtestStochCrossDown(s?.params.kPeriod ?? 14, s?.params.dPeriod ?? 3);
    },
  },
  // --- MACD histogram conditions ---
  macdHistogramRising: {
    streaming: (_ref, inds) => streaming.macdHistogramRising(findIndicatorName(inds, "macd")),
    backtest: (_ref, inds) => {
      const m = inds.find((i) => i.type === "macd");
      return macdCrossUp(
        m?.params.fastPeriod ?? 12,
        m?.params.slowPeriod ?? 26,
        m?.params.signalPeriod ?? 9,
      );
    },
  },
  macdHistogramFalling: {
    streaming: (_ref, inds) => streaming.macdHistogramFalling(findIndicatorName(inds, "macd")),
    backtest: (_ref, inds) => {
      const m = inds.find((i) => i.type === "macd");
      return macdCrossDown(
        m?.params.fastPeriod ?? 12,
        m?.params.slowPeriod ?? 26,
        m?.params.signalPeriod ?? 9,
      );
    },
  },
  // --- DMI/ADX conditions ---
  adxStrong: {
    streaming: (ref, inds) =>
      streaming.adxStrong((ref.params?.threshold as number) ?? 25, findIndicatorName(inds, "dmi")),
    backtest: (ref, inds) => {
      const d = inds.find((i) => i.type === "dmi");
      return backtestAdxStrong((ref.params?.threshold as number) ?? 25, d?.params.period ?? 14);
    },
  },
  dmiCrossUp: {
    streaming: (_ref, inds) => streaming.dmiCrossUp(findIndicatorName(inds, "dmi")),
    backtest: (_ref, inds) => {
      const d = inds.find((i) => i.type === "dmi");
      return backtestDmiBullish(20, d?.params.period ?? 14);
    },
  },
  // --- Volume conditions ---
  cmfAbove: {
    streaming: (ref, inds) =>
      streaming.cmfAbove(
        (ref.params?.threshold as number) ?? 0,
        findIndicatorName(inds, "cmfIndicator"),
      ),
    backtest: (ref, _inds) => backtestCmfAbove((ref.params?.threshold as number) ?? 0),
  },
  cmfBelow: {
    streaming: (ref, inds) =>
      streaming.cmfBelow(
        (ref.params?.threshold as number) ?? 0,
        findIndicatorName(inds, "cmfIndicator"),
      ),
    backtest: (ref, _inds) => backtestCmfBelow((ref.params?.threshold as number) ?? 0),
  },
  obvRising: {
    streaming: (_ref, inds) => streaming.obvRising(findIndicatorName(inds, "obv")),
    backtest: (_ref, _inds) => backtestObvRising(),
  },
  obvFalling: {
    streaming: (_ref, inds) => streaming.obvFalling(findIndicatorName(inds, "obv")),
    backtest: (_ref, _inds) => backtestObvFalling(),
  },
  volumeAboveAvg: {
    streaming: (ref, _inds) => streaming.volumeAboveAvg((ref.params?.multiplier as number) ?? 1.5),
    backtest: (ref, _inds) => backtestVolumeAboveAvg((ref.params?.multiplier as number) ?? 1.5),
  },
  // --- Volatility conditions ---
  atrPercentAbove: {
    streaming: (ref, inds) =>
      streaming.atrPercentAbove(
        (ref.params?.threshold as number) ?? 2.3,
        findIndicatorName(inds, "atr"),
      ),
    backtest: (ref, _inds) => backtestAtrPercentAbove((ref.params?.threshold as number) ?? 2.3),
  },
  atrPercentBelow: {
    streaming: (ref, inds) =>
      streaming.atrPercentBelow(
        (ref.params?.threshold as number) ?? 1.0,
        findIndicatorName(inds, "atr"),
      ),
    backtest: (ref, _inds) => backtestAtrPercentBelow((ref.params?.threshold as number) ?? 1.0),
  },
  volatilityExpanding: {
    streaming: (_ref, inds) => streaming.volatilityExpanding(findIndicatorName(inds, "atr")),
    backtest: (_ref, _inds) => backtestVolatilityExpanding(),
  },
  volatilityContracting: {
    streaming: (_ref, inds) => streaming.volatilityContracting(findIndicatorName(inds, "atr")),
    backtest: (_ref, _inds) => backtestVolatilityContracting(),
  },
  // --- Supertrend conditions ---
  supertrendBullish: {
    streaming: (_ref, inds) => streaming.supertrendBullish(findIndicatorName(inds, "supertrend")),
    backtest: (_ref, inds) => {
      const name = findIndicatorName(inds, "supertrend");
      return (indicators, _candle, index, candles) => {
        ensureIndicator(indicators, name, inds, candles);
        const series = indicators[name] as
          | { time: number; value: { direction: string } }[]
          | undefined;
        return series?.[index]?.value?.direction === "up";
      };
    },
  },
  supertrendBearish: {
    streaming: (_ref, inds) => streaming.supertrendBearish(findIndicatorName(inds, "supertrend")),
    backtest: (_ref, inds) => {
      const name = findIndicatorName(inds, "supertrend");
      return (indicators, _candle, index, candles) => {
        ensureIndicator(indicators, name, inds, candles);
        const series = indicators[name] as
          | { time: number; value: { direction: string } }[]
          | undefined;
        return series?.[index]?.value?.direction === "down";
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
      metadata: {
        ...(template.backtestTimeframe && {
          backtestTimeframe: template.backtestTimeframe,
          backtestPeriodDays: template.backtestPeriodDays,
        }),
        ...(template.mtfIndicators && { mtfIndicators: template.mtfIndicators }),
        ...(template.position.orderType && { orderType: template.position.orderType }),
        ...(template.position.limitOffsetPercent != null && {
          limitOffsetPercent: template.position.limitOffsetPercent,
        }),
      },
    };

    return { ok: true, strategy };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Indicator compilation (via registry)
// ---------------------------------------------------------------------------

function compileIndicator(ind: IndicatorRef): IncrementalFactory {
  const def = INDICATOR_REGISTRY[ind.type];
  if (!def) throw new Error(`Unknown indicator type: ${ind.type}`);
  return def.createIncremental(ind.params);
}

/**
 * Compute indicator series on demand and cache in the indicators object.
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

  const def = INDICATOR_REGISTRY[ref.type];
  if (!def) return;

  indicatorCache[indicatorName] = def.computeBatch(candles, ref.params);
}

// ---------------------------------------------------------------------------
// Pipeline & condition compilation (via registry)
// ---------------------------------------------------------------------------

function buildPipeline(template: StrategyTemplate): streaming.PipelineOptions {
  // Merge template indicators with auto-injected ones
  const effectiveIndicators = [...template.indicators];

  const indicators = effectiveIndicators.map((ind) => ({
    name: ind.name,
    create: compileIndicator(ind),
  }));

  let entry = compileStreamingCondition(template.entry, effectiveIndicators);
  const exit = compileStreamingCondition(template.exit, effectiveIndicators);

  // Regime gate: auto-inject regime indicator and wrap entry with regimeFilter
  if (template.regimeGate) {
    const gate = template.regimeGate;
    const hasRegime = effectiveIndicators.some((i) => i.type === "regime");
    if (!hasRegime) {
      const regimeDef = INDICATOR_REGISTRY.regime;
      indicators.push({
        name: "regime",
        create: regimeDef.createIncremental({}),
      });
    }

    const regimeCondition = streaming.regimeFilter({
      key: "regime",
      minTrendStrength: gate.minTrendStrength,
      allowedTrends: gate.allowedTrends,
      allowedVolatility: gate.allowedVolatility,
    });

    entry = streaming.and(regimeCondition, entry);
  }

  return { indicators, entry, exit };
}

function compileStreamingConditionRef(
  ref: ConditionRef,
  indicators: IndicatorRef[],
): streaming.StreamingCondition {
  const def = CONDITION_REGISTRY[ref.type];
  if (!def) throw new Error(`Unknown condition type: ${ref.type}`);
  return def.streaming(ref, indicators);
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

function compileBacktestConditionRef(ref: ConditionRef, indicators: IndicatorRef[]): Condition {
  const def = CONDITION_REGISTRY[ref.type];
  if (!def) throw new Error(`Unknown backtest condition type: ${ref.type}`);
  return def.backtest(ref, indicators);
}

function compileBacktestCondition(rule: ConditionRule, indicators: IndicatorRef[]): Condition {
  if (isCombined(rule)) {
    const compiled = rule.conditions.map((c) => compileBacktestConditionRef(c, indicators));
    return rule.operator === "and" ? backtestAnd(...compiled) : backtestOr(...compiled);
  }
  return compileBacktestConditionRef(rule, indicators);
}

// ---------------------------------------------------------------------------
// Backtest config builder
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findIndicatorName(indicators: IndicatorRef[], type: string): string {
  const found = indicators.find((i) => i.type === type);
  return found?.name ?? type;
}

/**
 * Sort indicators of a given type by period and return the short/long names.
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

  if (!key.includes(".") && key !== "vwap") {
    return direction === "above" ? streaming.priceAbove(key) : streaming.priceBelow(key);
  }

  const fn: streaming.StreamingConditionFn = (
    snapshot: streaming.IndicatorSnapshot,
    candle: NormalizedCandle,
  ) => {
    const value = streaming.resolveNumber(snapshot, resolveKey);
    if (value === null) {
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
 * Build custom backtest condition for price/indicator comparisons.
 */
function buildBacktestCustomCondition(ref: ConditionRef, indicatorRefs: IndicatorRef[]): Condition {
  const key = ref.params?.indicatorKey as string;
  const threshold = ref.params?.threshold as number | undefined;

  return (indicators, candle, index, candles) => {
    const parts = key?.split(".") ?? [];
    let value: number | null = null;

    const indicatorName = parts[0];
    if (!indicatorName) return false;

    ensureIndicator(indicators, indicatorName, indicatorRefs, candles);

    if (parts.length === 2) {
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

function buildBacktestStochCrossUp(threshold: number, indicatorRefs: IndicatorRef[]): Condition {
  return (indicators, _candle, index, candles) => {
    if (index < 1) return false;
    const series = resolveStochSeries(indicators, indicatorRefs, candles);
    if (!series) return false;
    const curr = series[index]?.value;
    const prev = series[index - 1]?.value;
    if (!curr?.k || !curr?.d || !prev?.k || !prev?.d) return false;
    return curr.k < threshold && prev.k <= prev.d && curr.k > curr.d;
  };
}

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
    case "risk-based": {
      // Auto-upgrade to ATR-based sizing when an ATR indicator is present
      const atrInd = template.indicators.find((i) => i.type === "atr");
      if (atrInd) {
        const multiplier = template.position.atrTrailingStop?.multiplier ?? 2;
        sizing = {
          method: "atr-based" as const,
          riskPercent: template.position.riskPercent ?? 1,
          atrKey: atrInd.name,
          atrMultiplier: multiplier,
        };
      } else {
        sizing = {
          method: "risk-based" as const,
          riskPercent: template.position.riskPercent ?? 1,
        };
      }
      break;
    }
    case "fixed-fractional":
      sizing = {
        method: "fixed-fractional" as const,
        fractionPercent: template.position.riskPercent ?? 10,
      };
      break;
    case "kelly":
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
    direction: (template.direction ?? "long") as "long" | "short",
    sizing,
    stopLoss: template.position.stopLoss,
    ...(template.position.takeProfit !== undefined && {
      takeProfit: template.position.takeProfit,
    }),
    ...(template.position.trailingStop !== undefined && {
      trailingStop: template.position.trailingStop,
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
}
