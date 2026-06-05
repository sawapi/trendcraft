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
 *
 * State category: **Mixed** — although every field is a buffer, the
 * `delayBuffer` holds period-dependent *derived* values (tenkan / kijun
 * mid-prices), so a windowed carry-forward across a period change is
 * not mathematically well-defined. Resume with any param change is
 * refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

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
 * Bare state shape for Ichimoku. Params (`tenkanPeriod`, `kijunPeriod`,
 * `senkouBPeriod`, `displacement`) live in `meta.params` on the wire.
 */
export type IchimokuState = {
  tenkanHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  tenkanLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  kijunHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  kijunLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  senkouBHighBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  senkouBLowBuf: ReturnType<CircularBuffer<number>["snapshot"]>;
  delayBuffer: MidPricePair[];
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ICHIMOKU_VERSION = 1;

type IchimokuParams = {
  tenkanPeriod: number;
  kijunPeriod: number;
  senkouBPeriod: number;
  displacement: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<IchimokuState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<IchimokuValue, IndicatorSnapshot<IchimokuState>> {
  const { params, state } = resolveResume<IchimokuParams, IchimokuState>({
    indicator: "ichimoku",
    version: ICHIMOKU_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52, displacement: 26 },
  });

  const tenkanPeriod = requireParam(
    "ichimoku",
    params,
    "tenkanPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const kijunPeriod = requireParam(
    "ichimoku",
    params,
    "kijunPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const senkouBPeriod = requireParam(
    "ichimoku",
    params,
    "senkouBPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const displacement = requireParam(
    "ichimoku",
    params,
    "displacement",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let tenkanHighBuf: CircularBuffer<number>;
  let tenkanLowBuf: CircularBuffer<number>;
  let kijunHighBuf: CircularBuffer<number>;
  let kijunLowBuf: CircularBuffer<number>;
  let senkouBHighBuf: CircularBuffer<number>;
  let senkouBLowBuf: CircularBuffer<number>;
  let delayBuffer: MidPricePair[];
  let count: number;

  if (state !== null) {
    tenkanHighBuf = CircularBuffer.fromSnapshot(state.tenkanHighBuf);
    tenkanLowBuf = CircularBuffer.fromSnapshot(state.tenkanLowBuf);
    kijunHighBuf = CircularBuffer.fromSnapshot(state.kijunHighBuf);
    kijunLowBuf = CircularBuffer.fromSnapshot(state.kijunLowBuf);
    senkouBHighBuf = CircularBuffer.fromSnapshot(state.senkouBHighBuf);
    senkouBLowBuf = CircularBuffer.fromSnapshot(state.senkouBLowBuf);
    delayBuffer = [...state.delayBuffer];
    count = state.count;
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

  function computeMidPrice(
    highBuf: CircularBuffer<number>,
    lowBuf: CircularBuffer<number>,
    period: number,
  ): number | null {
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

  const indicator: IncrementalIndicator<IchimokuValue, IndicatorSnapshot<IchimokuState>> = {
    next(candle: NormalizedCandle) {
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState().state;
      const result = indicator.next(candle);

      // Restore
      tenkanHighBuf = CircularBuffer.fromSnapshot(saved.tenkanHighBuf);
      tenkanLowBuf = CircularBuffer.fromSnapshot(saved.tenkanLowBuf);
      kijunHighBuf = CircularBuffer.fromSnapshot(saved.kijunHighBuf);
      kijunLowBuf = CircularBuffer.fromSnapshot(saved.kijunLowBuf);
      senkouBHighBuf = CircularBuffer.fromSnapshot(saved.senkouBHighBuf);
      senkouBLowBuf = CircularBuffer.fromSnapshot(saved.senkouBLowBuf);
      delayBuffer = [...saved.delayBuffer];
      count = saved.count;

      return result;
    },

    getState(): IndicatorSnapshot<IchimokuState> {
      return makeSnapshot(
        "ichimoku",
        ICHIMOKU_VERSION,
        { tenkanPeriod, kijunPeriod, senkouBPeriod, displacement },
        {
          tenkanHighBuf: tenkanHighBuf.snapshot(),
          tenkanLowBuf: tenkanLowBuf.snapshot(),
          kijunHighBuf: kijunHighBuf.snapshot(),
          kijunLowBuf: kijunLowBuf.snapshot(),
          senkouBHighBuf: senkouBHighBuf.snapshot(),
          senkouBLowBuf: senkouBLowBuf.snapshot(),
          delayBuffer: delayBuffer.map((d) => ({ ...d })),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Two displaced channels gate readiness: `senkouA` depends on a
      // valid kijun from `displacement` bars ago (so it needs
      // `kijunPeriod + displacement`) and `senkouB` needs
      // `senkouBPeriod + displacement`. The slower of the two wins.
      return count >= Math.max(kijunPeriod, senkouBPeriod) + displacement;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
