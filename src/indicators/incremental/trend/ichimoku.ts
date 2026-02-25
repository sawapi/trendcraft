/**
 * Incremental Ichimoku Kinko Hyo (一目均衡表)
 *
 * Components:
 * - Tenkan-sen: (Highest High + Lowest Low) / 2 over tenkanPeriod
 * - Kijun-sen: (Highest High + Lowest Low) / 2 over kijunPeriod
 * - Senkou Span A: (Tenkan + Kijun) / 2, displaced forward by `displacement`
 * - Senkou Span B: Mid-price over senkouBPeriod, displaced forward by `displacement`
 * - Chikou Span: Close displaced backward (requires future data, always null in incremental mode)
 *
 * Note: senkouA/B at bar i use values from `displacement` bars ago.
 * Chikou requires future data and cannot be computed incrementally.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

/**
 * Ichimoku output value
 */
export type IchimokuValue = {
  tenkan: number | null;
  kijun: number | null;
  senkouA: number | null;
  senkouB: number | null;
  chikou: number | null;
};

/**
 * Mid-price pair for delay buffer
 */
type MidPricePair = { tenkan: number | null; kijun: number | null; senkouBBase: number | null };

/**
 * State for incremental Ichimoku
 */
export type IchimokuState = {
  tenkanPeriod: number;
  kijunPeriod: number;
  senkouBPeriod: number;
  displacement: number;
  tenkanHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  tenkanLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  kijunHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  kijunLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  senkouBHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  senkouBLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  delayBuffer: MidPricePair[];
  count: number;
};

function bufferMinMax(buf: CircularBuffer<number>): { min: number; max: number } {
  let min = buf.get(0);
  let max = buf.get(0);
  for (let i = 1; i < buf.length; i++) {
    const v = buf.get(i);
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { min, max };
}

function midPrice(buf: CircularBuffer<number>, period: number, highOrLow: "high" | "low", otherBuf: CircularBuffer<number>): number | null {
  if (buf.length < period) return null;
  const { max } = bufferMinMax(buf);
  const { min } = bufferMinMax(otherBuf);
  return (max + min) / 2;
}

/**
 * Create an incremental Ichimoku indicator
 *
 * @example
 * ```ts
 * const ichi = createIchimoku({ tenkanPeriod: 9, kijunPeriod: 26 });
 * for (const candle of stream) {
 *   const { value } = ichi.next(candle);
 *   if (ichi.isWarmedUp) console.log(value.tenkan, value.kijun, value.senkouA);
 * }
 * ```
 */
export function createIchimoku(
  options: {
    tenkanPeriod?: number;
    kijunPeriod?: number;
    senkouBPeriod?: number;
    displacement?: number;
  } = {},
  warmUpOptions?: WarmUpOptions<IchimokuState>,
): IncrementalIndicator<IchimokuValue, IchimokuState> {
  const tenkanPeriod = options.tenkanPeriod ?? 9;
  const kijunPeriod = options.kijunPeriod ?? 26;
  const senkouBPeriod = options.senkouBPeriod ?? 52;
  const displacement = options.displacement ?? 26;

  let tenkanHighBuf: CircularBuffer<number>;
  let tenkanLowBuf: CircularBuffer<number>;
  let kijunHighBuf: CircularBuffer<number>;
  let kijunLowBuf: CircularBuffer<number>;
  let senkouBHighBuf: CircularBuffer<number>;
  let senkouBLowBuf: CircularBuffer<number>;
  let delayBuffer: MidPricePair[];
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    tenkanHighBuf = CircularBuffer.fromSnapshot(s.tenkanHighBuf);
    tenkanLowBuf = CircularBuffer.fromSnapshot(s.tenkanLowBuf);
    kijunHighBuf = CircularBuffer.fromSnapshot(s.kijunHighBuf);
    kijunLowBuf = CircularBuffer.fromSnapshot(s.kijunLowBuf);
    senkouBHighBuf = CircularBuffer.fromSnapshot(s.senkouBHighBuf);
    senkouBLowBuf = CircularBuffer.fromSnapshot(s.senkouBLowBuf);
    delayBuffer = [...s.delayBuffer];
    count = s.count;
  } else {
    tenkanHighBuf = new CircularBuffer<number>(tenkanPeriod);
    tenkanLowBuf = new CircularBuffer<number>(tenkanPeriod);
    kijunHighBuf = new CircularBuffer<number>(kijunPeriod);
    kijunLowBuf = new CircularBuffer<number>(kijunPeriod);
    senkouBHighBuf = new CircularBuffer<number>(senkouBPeriod);
    senkouBLowBuf = new CircularBuffer<number>(senkouBPeriod);
    delayBuffer = [];
    count = 0;
  }

  function computeMidPrice(highBuf: CircularBuffer<number>, lowBuf: CircularBuffer<number>, period: number): number | null {
    if (highBuf.length < period) return null;
    const { max } = bufferMinMax(highBuf);
    const { min } = bufferMinMax(lowBuf);
    return (max + min) / 2;
  }

  function processCandle(candle: NormalizedCandle): IchimokuValue {
    tenkanHighBuf.push(candle.high);
    tenkanLowBuf.push(candle.low);
    kijunHighBuf.push(candle.high);
    kijunLowBuf.push(candle.low);
    senkouBHighBuf.push(candle.high);
    senkouBLowBuf.push(candle.low);
    count++;

    const tenkan = computeMidPrice(tenkanHighBuf, tenkanLowBuf, tenkanPeriod);
    const kijun = computeMidPrice(kijunHighBuf, kijunLowBuf, kijunPeriod);
    const senkouBBase = computeMidPrice(senkouBHighBuf, senkouBLowBuf, senkouBPeriod);

    // Store current values for delayed emission
    delayBuffer.push({ tenkan, kijun, senkouBBase });

    // Senkou values come from `displacement` bars ago
    let senkouA: number | null = null;
    let senkouB: number | null = null;

    if (delayBuffer.length > displacement) {
      const delayed = delayBuffer[delayBuffer.length - 1 - displacement];
      if (delayed.tenkan !== null && delayed.kijun !== null) {
        senkouA = (delayed.tenkan + delayed.kijun) / 2;
      }
      senkouB = delayed.senkouBBase;
    }

    // Chikou requires future data - not available in incremental mode
    return { tenkan, kijun, senkouA, senkouB, chikou: null };
  }

  const indicator: IncrementalIndicator<IchimokuValue, IchimokuState> = {
    next(candle: NormalizedCandle) {
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const savedState = indicator.getState();
      const result = indicator.next(candle);

      // Restore
      tenkanHighBuf = CircularBuffer.fromSnapshot(savedState.tenkanHighBuf);
      tenkanLowBuf = CircularBuffer.fromSnapshot(savedState.tenkanLowBuf);
      kijunHighBuf = CircularBuffer.fromSnapshot(savedState.kijunHighBuf);
      kijunLowBuf = CircularBuffer.fromSnapshot(savedState.kijunLowBuf);
      senkouBHighBuf = CircularBuffer.fromSnapshot(savedState.senkouBHighBuf);
      senkouBLowBuf = CircularBuffer.fromSnapshot(savedState.senkouBLowBuf);
      delayBuffer = [...savedState.delayBuffer];
      count = savedState.count;

      return result;
    },

    getState(): IchimokuState {
      return {
        tenkanPeriod,
        kijunPeriod,
        senkouBPeriod,
        displacement,
        tenkanHighBuf: tenkanHighBuf.snapshot(),
        tenkanLowBuf: tenkanLowBuf.snapshot(),
        kijunHighBuf: kijunHighBuf.snapshot(),
        kijunLowBuf: kijunLowBuf.snapshot(),
        senkouBHighBuf: senkouBHighBuf.snapshot(),
        senkouBLowBuf: senkouBLowBuf.snapshot(),
        delayBuffer: delayBuffer.map(d => ({ ...d })),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Kijun (longest non-displaced period) and displacement for senkou
      return count >= kijunPeriod + displacement;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
