/**
 * Incremental Volatility Regime Detection
 *
 * Classifies market conditions into volatility regimes (low/normal/high)
 * and trend states (bullish/bearish/sideways) with trend strength (ADX).
 *
 * Composes ATR, Bollinger Bands, DMI, and SMA incremental indicators
 * to produce a snapshot compatible with regimeFilter().
 */

import type { NormalizedCandle } from "../../../types";
import { type DmiState, createDmi } from "../../incremental/momentum/dmi";
import { type SmaState, createSma } from "../../incremental/moving-average/sma";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { type AtrState, createAtr } from "./atr";
import { type BollingerBandsState, createBollingerBands } from "./bollinger-bands";

/**
 * Regime indicator output value
 *
 * Shape matches what regimeFilter() expects from the snapshot.
 */
export type RegimeValue = {
  /** Volatility classification */
  volatility: "low" | "normal" | "high";
  /** Trend direction */
  trend: "bullish" | "bearish" | "sideways";
  /** Trend strength from ADX (0-100) */
  trendStrength: number;
};

export type RegimeState = {
  atrPeriod: number;
  bbPeriod: number;
  dmiPeriod: number;
  lookback: number;
  atrState: AtrState;
  bbState: BollingerBandsState;
  dmiState: DmiState;
  smaState: SmaState;
  atrBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  bwBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

export type RegimeOptions = {
  /** ATR period (default: 14) */
  atrPeriod?: number;
  /** Bollinger Bands period (default: 20) */
  bbPeriod?: number;
  /** DMI/ADX period (default: 14) */
  dmiPeriod?: number;
  /** Lookback for percentile + SMA trend (default: 100) */
  lookback?: number;
};

/**
 * Calculate percentile rank of the newest value within a circular buffer
 */
function percentileRank(buf: CircularBuffer<number>): number | null {
  if (buf.length < 10) return null;
  const current = buf.newest();
  let countBelow = 0;
  let countEqual = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf.get(i);
    if (v < current) countBelow++;
    else if (v === current) countEqual++;
  }
  return ((countBelow + 0.5 * countEqual) / buf.length) * 100;
}

/**
 * Create an incremental regime indicator
 *
 * Produces volatility/trend/trendStrength values that are directly
 * consumable by regimeFilter() in streaming conditions.
 *
 * @example
 * ```ts
 * const regime = createRegime({ lookback: 100 });
 * for (const candle of stream) {
 *   const { value } = regime.next(candle);
 *   if (regime.isWarmedUp) {
 *     console.log(value.volatility, value.trend, value.trendStrength);
 *   }
 * }
 * ```
 */
export function createRegime(
  options: RegimeOptions = {},
  warmUpOptions?: WarmUpOptions<RegimeState>,
): IncrementalIndicator<RegimeValue | null, RegimeState> {
  const atrPeriod = options.atrPeriod ?? 14;
  const bbPeriod = options.bbPeriod ?? 20;
  const dmiPeriod = options.dmiPeriod ?? 14;
  const lookback = options.lookback ?? 100;

  let atrInd: IncrementalIndicator<number | null, AtrState>;
  let bbInd: IncrementalIndicator<
    {
      upper: number | null;
      middle: number | null;
      lower: number | null;
      percentB: number | null;
      bandwidth: number | null;
    },
    BollingerBandsState
  >;
  let dmiInd: ReturnType<typeof createDmi>;
  let smaInd: IncrementalIndicator<number | null, SmaState>;
  let atrBuffer: CircularBuffer<number>;
  let bwBuffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    atrInd = createAtr({ period: atrPeriod }, { fromState: s.atrState });
    bbInd = createBollingerBands({ period: bbPeriod }, { fromState: s.bbState });
    dmiInd = createDmi({ period: dmiPeriod }, { fromState: s.dmiState });
    smaInd = createSma({ period: lookback }, { fromState: s.smaState });
    atrBuffer = CircularBuffer.fromSnapshot(s.atrBuffer);
    bwBuffer = CircularBuffer.fromSnapshot(s.bwBuffer);
    count = s.count;
  } else {
    atrInd = createAtr({ period: atrPeriod });
    bbInd = createBollingerBands({ period: bbPeriod });
    dmiInd = createDmi({ period: dmiPeriod });
    smaInd = createSma({ period: lookback });
    atrBuffer = new CircularBuffer<number>(lookback);
    bwBuffer = new CircularBuffer<number>(lookback);
    count = 0;
  }

  const indicator: IncrementalIndicator<RegimeValue | null, RegimeState> = {
    next(candle: NormalizedCandle) {
      count++;

      const atrResult = atrInd.next(candle);
      const bbResult = bbInd.next(candle);
      const dmiResult = dmiInd.next(candle);
      smaInd.next(candle);

      // Accumulate ATR values for percentile
      if (atrResult.value !== null) {
        atrBuffer.push(atrResult.value);
      }

      // Accumulate bandwidth values for percentile
      if (bbResult.value.bandwidth !== null) {
        bwBuffer.push(bbResult.value.bandwidth);
      }

      // Need ADX for trend strength; need buffers for percentile
      if (dmiResult.value.adx === null) {
        return { time: candle.time, value: null };
      }

      // Volatility classification
      const atrPct = percentileRank(atrBuffer);
      const bwPct = percentileRank(bwBuffer);

      let volatility: "low" | "normal" | "high" = "normal";
      const pcts: number[] = [];
      if (atrPct !== null) pcts.push(atrPct);
      if (bwPct !== null) pcts.push(bwPct);

      if (pcts.length > 0) {
        const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        if (avg <= 25) volatility = "low";
        else if (avg >= 75) volatility = "high";
      }

      // Trend direction from SMA slope
      let trend: "bullish" | "bearish" | "sideways" = "sideways";
      if (smaInd.isWarmedUp) {
        // Compare current close to SMA
        const smaVal = smaInd.peek(candle).value;
        if (smaVal !== null) {
          const diff = (candle.close - smaVal) / smaVal;
          if (diff > 0.001) trend = "bullish";
          else if (diff < -0.001) trend = "bearish";
        }
      }

      // Trend strength from ADX
      const trendStrength = Math.round(dmiResult.value.adx * 100) / 100;

      return {
        time: candle.time,
        value: { volatility, trend, trendStrength },
      };
    },

    peek(candle: NormalizedCandle) {
      const atrResult = atrInd.peek(candle);
      const bbResult = bbInd.peek(candle);
      const dmiResult = dmiInd.peek(candle);

      if (dmiResult.value.adx === null) {
        return { time: candle.time, value: null };
      }

      // Simulate adding to buffers for percentile
      const tempAtrBuf = CircularBuffer.fromSnapshot(atrBuffer.snapshot());
      if (atrResult.value !== null) tempAtrBuf.push(atrResult.value);

      const tempBwBuf = CircularBuffer.fromSnapshot(bwBuffer.snapshot());
      if (bbResult.value.bandwidth !== null) tempBwBuf.push(bbResult.value.bandwidth);

      let volatility: "low" | "normal" | "high" = "normal";
      const pcts: number[] = [];
      const atrPct = percentileRank(tempAtrBuf);
      const bwPct = percentileRank(tempBwBuf);
      if (atrPct !== null) pcts.push(atrPct);
      if (bwPct !== null) pcts.push(bwPct);

      if (pcts.length > 0) {
        const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        if (avg <= 25) volatility = "low";
        else if (avg >= 75) volatility = "high";
      }

      let trend: "bullish" | "bearish" | "sideways" = "sideways";
      if (smaInd.isWarmedUp) {
        const smaVal = smaInd.peek(candle).value;
        if (smaVal !== null) {
          const diff = (candle.close - smaVal) / smaVal;
          if (diff > 0.001) trend = "bullish";
          else if (diff < -0.001) trend = "bearish";
        }
      }

      const trendStrength = Math.round(dmiResult.value.adx * 100) / 100;

      return {
        time: candle.time,
        value: { volatility, trend, trendStrength },
      };
    },

    getState(): RegimeState {
      return {
        atrPeriod,
        bbPeriod,
        dmiPeriod,
        lookback,
        atrState: atrInd.getState(),
        bbState: bbInd.getState(),
        dmiState: dmiInd.getState(),
        smaState: smaInd.getState(),
        atrBuffer: atrBuffer.snapshot(),
        bwBuffer: bwBuffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return dmiInd.isWarmedUp && atrBuffer.length >= 10;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
