/**
 * Incremental KST (Know Sure Thing)
 *
 * KST = w1*SMA(ROC(r1), s1) + w2*SMA(ROC(r2), s2) + w3*SMA(ROC(r3), s3) + w4*SMA(ROC(r4), s4)
 * Signal = SMA(KST, signalPeriod)
 *
 * Uses 4 ROC + 4 SMA sub-indicators for the weighted components,
 * plus 1 SMA for the signal line.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { createSma } from "../moving-average/sma";
import type { SmaState } from "../moving-average/sma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice, makeCandle } from "../utils";
import { createRoc } from "./roc";
import type { RocState } from "./roc";

export type KstValue = {
  kst: number;
  signal: number | null;
};

export type KstState = {
  rocStates: [RocState, RocState, RocState, RocState];
  smaStates: [SmaState, SmaState, SmaState, SmaState];
  signalSmaState: SmaState;
  rocPeriods: [number, number, number, number];
  smaPeriods: [number, number, number, number];
  weights: [number, number, number, number];
  signalPeriod: number;
  source: PriceSource;
  count: number;
};

/**
 * Create an incremental KST (Know Sure Thing) indicator
 *
 * @example
 * ```ts
 * const kst = createKst({
 *   rocPeriods: [10, 15, 20, 30],
 *   smaPeriods: [10, 10, 10, 15],
 *   weights: [1, 2, 3, 4],
 *   signalPeriod: 9,
 * });
 * for (const candle of stream) {
 *   const { value } = kst.next(candle);
 *   if (value !== null) console.log(value.kst, value.signal);
 * }
 * ```
 */
export function createKst(
  options: {
    rocPeriods?: [number, number, number, number];
    smaPeriods?: [number, number, number, number];
    weights?: [number, number, number, number];
    signalPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<KstState>,
): IncrementalIndicator<KstValue | null, KstState> {
  const rocPeriods: [number, number, number, number] = options.rocPeriods ?? [10, 15, 20, 30];
  const smaPeriods: [number, number, number, number] = options.smaPeriods ?? [10, 10, 10, 15];
  const weights: [number, number, number, number] = options.weights ?? [1, 2, 3, 4];
  const signalPeriod = options.signalPeriod ?? 9;
  const source: PriceSource = options.source ?? "close";

  let rocs: ReturnType<typeof createRoc>[];
  let smas: ReturnType<typeof createSma>[];
  let signalSma: ReturnType<typeof createSma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    rocs = s.rocStates.map((rs, i) =>
      createRoc({ period: rocPeriods[i], source }, { fromState: rs }),
    );
    smas = s.smaStates.map((ss, i) => createSma({ period: smaPeriods[i] }, { fromState: ss }));
    signalSma = createSma({ period: signalPeriod }, { fromState: s.signalSmaState });
    count = s.count;
  } else {
    rocs = rocPeriods.map((p) => createRoc({ period: p, source }));
    smas = smaPeriods.map((p) => createSma({ period: p }));
    signalSma = createSma({ period: signalPeriod });
    count = 0;
  }

  function computeNext(candle: NormalizedCandle): { time: number; value: KstValue | null } {
    count++;

    const smoothed: (number | null)[] = new Array(4);
    for (let i = 0; i < 4; i++) {
      const rocResult = rocs[i].next(candle);
      if (rocResult.value !== null) {
        const smaResult = smas[i].next(makeCandle(candle.time, rocResult.value));
        smoothed[i] = smaResult.value;
      } else {
        smoothed[i] = null;
      }
    }

    // All 4 smoothed values must be non-null to compute KST
    if (
      smoothed[0] === null ||
      smoothed[1] === null ||
      smoothed[2] === null ||
      smoothed[3] === null
    ) {
      return { time: candle.time, value: null };
    }

    const kstVal =
      weights[0] * smoothed[0] +
      weights[1] * smoothed[1] +
      weights[2] * smoothed[2] +
      weights[3] * smoothed[3];

    const sigResult = signalSma.next(makeCandle(candle.time, kstVal));
    const signalVal = signalSma.isWarmedUp ? sigResult.value : null;

    return { time: candle.time, value: { kst: kstVal, signal: signalVal } };
  }

  function computePeek(candle: NormalizedCandle): { time: number; value: KstValue | null } {
    const smoothed: (number | null)[] = new Array(4);
    for (let i = 0; i < 4; i++) {
      const rocResult = rocs[i].peek(candle);
      if (rocResult.value !== null) {
        const smaResult = smas[i].peek(makeCandle(candle.time, rocResult.value));
        smoothed[i] = smaResult.value;
      } else {
        smoothed[i] = null;
      }
    }

    if (
      smoothed[0] === null ||
      smoothed[1] === null ||
      smoothed[2] === null ||
      smoothed[3] === null
    ) {
      return { time: candle.time, value: null };
    }

    const kstVal =
      weights[0] * smoothed[0] +
      weights[1] * smoothed[1] +
      weights[2] * smoothed[2] +
      weights[3] * smoothed[3];

    // Check if signal SMA would be warmed up after this peek
    const sigResult = signalSma.peek(makeCandle(candle.time, kstVal));
    const signalVal =
      signalSma.isWarmedUp || signalSma.count + 1 >= signalPeriod ? sigResult.value : null;

    return { time: candle.time, value: { kst: kstVal, signal: signalVal } };
  }

  const indicator: IncrementalIndicator<KstValue | null, KstState> = {
    next(candle: NormalizedCandle) {
      return computeNext(candle);
    },

    peek(candle: NormalizedCandle) {
      return computePeek(candle);
    },

    getState(): KstState {
      return {
        rocStates: rocs.map((r) => r.getState()) as [RocState, RocState, RocState, RocState],
        smaStates: smas.map((s) => s.getState()) as [SmaState, SmaState, SmaState, SmaState],
        signalSmaState: signalSma.getState(),
        rocPeriods,
        smaPeriods,
        weights,
        signalPeriod,
        source,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return signalSma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
