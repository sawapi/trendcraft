/**
 * Incremental KST (Know Sure Thing)
 *
 * KST = w1*SMA(ROC(r1), s1) + w2*SMA(ROC(r2), s2) + w3*SMA(ROC(r3), s3) + w4*SMA(ROC(r4), s4)
 * Signal = SMA(KST, signalPeriod)
 *
 * State category: **Cascaded** (composes 4 inner ROC + 4 inner SMA
 * stages plus 1 signal SMA). Resume with any changed period / weight /
 * source param is refused — all inner recursive/windowed stages are
 * conditioned on their construction-time params.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { createSma, type SmaState } from "../moving-average/sma";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { makeCandle } from "../utils";
import { createRoc, type RocState } from "./roc";

export type KstValue = {
  kst: number;
  signal: number | null;
};

/**
 * Bare state shape for KST. Params (`rocPeriods`, `smaPeriods`,
 * `weights`, `signalPeriod`, `source`) live in `meta.params`.
 */
export type KstState = {
  rocStates: [
    IndicatorSnapshot<RocState>,
    IndicatorSnapshot<RocState>,
    IndicatorSnapshot<RocState>,
    IndicatorSnapshot<RocState>,
  ];
  smaStates: [
    IndicatorSnapshot<SmaState>,
    IndicatorSnapshot<SmaState>,
    IndicatorSnapshot<SmaState>,
    IndicatorSnapshot<SmaState>,
  ];
  signalSmaState: IndicatorSnapshot<SmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const KST_VERSION = 1;

type Quad = [number, number, number, number];

type KstParams = {
  rocPeriods: Quad;
  smaPeriods: Quad;
  weights: Quad;
  signalPeriod: number;
  source: PriceSource;
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
    rocPeriods?: Quad;
    smaPeriods?: Quad;
    weights?: Quad;
    signalPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<KstState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<KstValue | null, IndicatorSnapshot<KstState>> {
  const { params, state } = resolveResume<KstParams, KstState>({
    indicator: "kst",
    version: KST_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {
      rocPeriods: [10, 15, 20, 30],
      smaPeriods: [10, 10, 10, 15],
      weights: [1, 2, 3, 4],
      signalPeriod: 9,
      source: "close",
    },
  });

  const rocPeriods = params.rocPeriods;
  const smaPeriods = params.smaPeriods;
  const weights = params.weights;
  const signalPeriod = params.signalPeriod;
  const source = params.source;

  let rocs: ReturnType<typeof createRoc>[];
  let smas: ReturnType<typeof createSma>[];
  let signalSma: ReturnType<typeof createSma>;
  let count: number;

  if (state !== null) {
    rocs = state.rocStates.map((rs, i) =>
      createRoc({ period: rocPeriods[i], source }, { fromState: rs }),
    );
    smas = state.smaStates.map((ss, i) => createSma({ period: smaPeriods[i] }, { fromState: ss }));
    signalSma = createSma({ period: signalPeriod }, { fromState: state.signalSmaState });
    count = state.count;
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

  const indicator: IncrementalIndicator<KstValue | null, IndicatorSnapshot<KstState>> = {
    next(candle: NormalizedCandle) {
      return computeNext(candle);
    },

    peek(candle: NormalizedCandle) {
      return computePeek(candle);
    },

    getState(): IndicatorSnapshot<KstState> {
      return makeSnapshot(
        "kst",
        KST_VERSION,
        { rocPeriods, smaPeriods, weights, signalPeriod, source },
        {
          rocStates: rocs.map((r) => r.getState()) as [
            IndicatorSnapshot<RocState>,
            IndicatorSnapshot<RocState>,
            IndicatorSnapshot<RocState>,
            IndicatorSnapshot<RocState>,
          ],
          smaStates: smas.map((s) => s.getState()) as [
            IndicatorSnapshot<SmaState>,
            IndicatorSnapshot<SmaState>,
            IndicatorSnapshot<SmaState>,
            IndicatorSnapshot<SmaState>,
          ],
          signalSmaState: signalSma.getState(),
          count,
        },
      );
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
