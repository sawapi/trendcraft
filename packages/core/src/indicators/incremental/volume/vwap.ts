/**
 * Incremental VWAP (Volume Weighted Average Price)
 *
 * State category: **Recursive** (cumulative TPV / volume accumulators
 * with session-boundary resets — no raw-price window to carry forward
 * across a parameter change). The accumulators encode which period they
 * belong to, so resuming under a different `session` throws rather than
 * carrying totals whose meaning has changed.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<VwapState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createVwap({ fromState })`) must add an empty
 * options object: `createVwap({}, { fromState })`.
 *
 * Resets at UTC midnight by default, or at the session boundary when a
 * `session` is supplied.
 */

import type { NormalizedCandle } from "../../../types";
import { resolveSessionMembership, type SessionDefinition } from "../../session/session-definition";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for VWAP. The `session` param lives in `meta.params` on the
 * wire — it is not part of the bare state.
 */
export type VwapState = {
  cumulativeTpv: number;
  cumulativeVolume: number;
  count: number;
  /**
   * Identifies the period the running totals belong to: a UTC day index by
   * default, or a session occurrence key when `session` is set.
   */
  currentOccurrence: number;
};

export type VwapValue = {
  vwap: number | null;
};

export type VwapOptions = {
  /**
   * Trading session the average belongs to.
   *
   * Without it, the average restarts at UTC midnight rather than at a session
   * boundary. For a stream limited to regular trading hours the two often
   * coincide — a US equity day sits inside one UTC date — but it breaks once
   * the stream carries extended hours, and never lines up for a session that
   * itself crosses UTC midnight.
   *
   * With it, only bars inside the session contribute. Bars outside the window,
   * and bars inside one of its breaks, return `null` and leave the running
   * totals untouched; `count` still advances, since a bar was still consumed.
   */
  session?: SessionDefinition;
};

/**
 * Per-indicator schema version. Bump on any breaking state change.
 *
 * v2 renamed `currentDay` to `currentOccurrence`: with a `session` the field
 * holds an occurrence key rather than a UTC day index, and a snapshot written
 * by v1 cannot be told apart from one written under a different anchoring.
 * Snapshots taken before this version need a re-warm.
 */
export const VWAP_VERSION = 2;

const MS_PER_DAY = 86400000;

type VwapParams = {
  session?: SessionDefinition;
};

/**
 * Create an incremental VWAP indicator (session-based with daily reset)
 *
 * @example
 * ```ts
 * const vwap = createVwap();
 * for (const candle of stream) {
 *   const { value } = vwap.next(candle);
 *   console.log(value.vwap);
 * }
 * ```
 */
export function createVwap(
  options: VwapOptions = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VwapState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VwapValue, IndicatorSnapshot<VwapState>> {
  const { params, state } = resolveResume<VwapParams, VwapState>({
    indicator: "vwap",
    version: VWAP_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  const session = params.session;

  let cumulativeTpv: number;
  let cumulativeVolume: number;
  let count: number;
  let currentOccurrence: number;

  if (state !== null) {
    cumulativeTpv = state.cumulativeTpv;
    cumulativeVolume = state.cumulativeVolume;
    count = state.count;
    currentOccurrence = state.currentOccurrence;
  } else {
    cumulativeTpv = 0;
    cumulativeVolume = 0;
    count = 0;
    currentOccurrence = -1;
  }

  /**
   * The period a bar's totals belong to, or `null` when the bar is not part of
   * any — outside the session, or inside one of its breaks.
   */
  function occurrenceFor(candle: NormalizedCandle): number | null {
    if (!session) {
      return Math.floor(candle.time / MS_PER_DAY);
    }

    const membership = resolveSessionMembership(candle.time, session);
    return membership.active ? membership.occurrenceKey : null;
  }

  function processCandle(candle: NormalizedCandle, advance: boolean): VwapValue {
    const occurrence = occurrenceFor(candle);

    if (occurrence === null) {
      // Not part of the session: no value, and the totals stay where they are.
      return { vwap: null };
    }

    let localTpv = cumulativeTpv;
    let localVolume = cumulativeVolume;

    if (occurrence !== currentOccurrence) {
      localTpv = 0;
      localVolume = 0;
    }

    const tp = (candle.high + candle.low + candle.close) / 3;
    localTpv += tp * candle.volume;
    localVolume += candle.volume;

    if (advance) {
      cumulativeTpv = localTpv;
      cumulativeVolume = localVolume;
      currentOccurrence = occurrence;
    }

    return { vwap: localVolume > 0 ? localTpv / localVolume : null };
  }

  const indicator: IncrementalIndicator<VwapValue, IndicatorSnapshot<VwapState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle, true);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: processCandle(candle, false) };
    },

    getState(): IndicatorSnapshot<VwapState> {
      return makeSnapshot("vwap", VWAP_VERSION, session ? { session } : {}, {
        cumulativeTpv,
        cumulativeVolume,
        count,
        currentOccurrence,
      });
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
