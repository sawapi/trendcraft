/**
 * State Contract integration tests for migrated indicators.
 *
 * Every indicator migrated to the 0.4.0 State Contract registers
 * here via `describeContract`. The DSL generates the seven invariants
 * (round-trip, name guard, version guard, reconfig per category,
 * peek consistency, warmup gate) automatically — pinning the contract
 * uniformly across the library.
 *
 * Phase 2 migration adds entries to this file. The file should never
 * shrink (only add new indicators) so this becomes a stable "what's
 * migrated" registry.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { alma } from "../../moving-average/alma";
import { mcginleyDynamic } from "../../moving-average/mcginley-dynamic";
import { sma } from "../../moving-average/sma";
import { vwma } from "../../moving-average/vwma";
import { wma } from "../../moving-average/wma";
import { highest, lowest } from "../../price/highest-lowest";
import { returns as returnsBatch } from "../../price/returns";
import { choppinessIndex } from "../../volatility/choppiness-index";
import { donchianChannel } from "../../volatility/donchian-channel";
import { ewmaVolatilityFromCandles } from "../../volatility/garch";
import { standardDeviation } from "../../volatility/standard-deviation";
import { ulcerIndex } from "../../volatility/ulcer-index";
import { adl } from "../../volume/adl";
import { anchoredVwap } from "../../volume/anchored-vwap";
import { cvd } from "../../volume/cvd";
import { nvi } from "../../volume/nvi";
import { obv } from "../../volume/obv";
import { pvt } from "../../volume/pvt";
import { twap } from "../../volume/twap";
import { vwap } from "../../volume/vwap";
import { type AlmaState, createAlma } from "../moving-average/alma";
import {
  createMcGinleyDynamic,
  type McGinleyDynamicState,
} from "../moving-average/mcginley-dynamic";
import { createSma, type SmaState } from "../moving-average/sma";
import { createVwma, type VwmaState } from "../moving-average/vwma";
import { createWma, type WmaState } from "../moving-average/wma";
import { createHighestLowest, type HighestLowestState } from "../price/highest-lowest";
import { createReturns, type ReturnsState } from "../price/returns";
import { type ChoppinessIndexState, createChoppinessIndex } from "../volatility/choppiness-index";
import { createDonchianChannel, type DonchianState } from "../volatility/donchian-channel";
import { createEwmaVolatility, type EwmaVolatilityState } from "../volatility/ewma-volatility";
import {
  createStandardDeviation,
  type StandardDeviationState,
} from "../volatility/standard-deviation";
import { createUlcerIndex, type UlcerIndexState } from "../volatility/ulcer-index";
import { type AdlState, createAdl } from "../volume/adl";
import { type AnchoredVwapState, createAnchoredVwap } from "../volume/anchored-vwap";
import { type CvdState, createCvd } from "../volume/cvd";
import { createNvi, type NviState } from "../volume/nvi";
import { createObv, type ObvState } from "../volume/obv";
import { createPvt, type PvtState } from "../volume/pvt";
import { createTwap, type TwapState } from "../volume/twap";
import { createVwap, type VwapState } from "../volume/vwap";
import { describeContract } from "./contract-helper";

// ---- Shared candle generator ----

function makeCandles(n: number): NormalizedCandle[] {
  // Deterministic, mildly volatile series: trend + sine + noise.
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i * 0.05 + Math.sin(i * 0.3) * 5 + ((i * 7) % 11) * 0.1;
    return {
      time: 1700000000000 + i * 86400000,
      open: close - 0.3,
      high: close + 1.2,
      low: close - 1.1,
      close,
      volume: 1000 + (i % 13) * 50,
    };
  });
}

// ---- SMA (Wave 1, Category Windowed, version 1) ----

describeContract<number | null, SmaState>({
  name: "sma",
  create: (opts, warmUp) =>
    createSma(opts as { period?: number; source?: "close" | "high" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 8 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    sma(candles, opts as { period: number; source?: "close" | "high" }).map((s) => s.value),
});

// ---- ALMA (Wave 1 ALMA cluster, Category Windowed, version 1) ----

describeContract<number | null, AlmaState>({
  name: "alma",
  create: (opts, warmUp) =>
    createAlma(
      opts as {
        period?: number;
        offset?: number;
        sigma?: number;
        source?: "close" | "high";
      },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: { period: 9, offset: 0.85, sigma: 6, source: "close" },
  // Mix period changes with offset/sigma changes so the windowed
  // reconfig invariant exercises shape changes that aren't just
  // period grows/shrinks.
  reconfigParams: [{ period: 14 }, { period: 5 }, { offset: 0.5 }, { sigma: 3 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    alma(
      candles,
      opts as { period?: number; offset?: number; sigma?: number; source?: "close" | "high" },
    ).map((s) => s.value),
});

// ---- WMA (Wave 1 WMA cluster, Category Windowed, version 1) ----

describeContract<number | null, WmaState>({
  name: "wma",
  create: (opts, warmUp) =>
    createWma(opts as { period?: number; source?: "close" | "high" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    wma(candles, opts as { period: number; source?: "close" | "high" }).map((s) => s.value),
});

// ---- Bundle A: VWMA / Choppiness Index / Ulcer Index / TWAP ----

// VWMA — Windowed, same defaultless-period pattern as SMA/WMA.
describeContract<number | null, VwmaState>({
  name: "vwma",
  create: (opts, warmUp) =>
    createVwma(opts as { period?: number; source?: "close" | "high" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    vwma(candles, opts as { period: number; source?: "close" | "high" }).map((s) => s.value),
});

// Choppiness Index — Windowed; `period` has a canonical default of 14
// (Bill Dreiss). TR/H/L buffers carry forward as raw values.
describeContract<number | null, ChoppinessIndexState>({
  name: "choppinessIndex",
  create: (opts, warmUp) => createChoppinessIndex(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 7 }, { period: 28 }],
  makeCandles,
  streamLength: 200,
  batchCompute: (opts, candles) =>
    choppinessIndex(candles, opts as { period?: number }).map((s) => s.value),
});

// Ulcer Index — Windowed two-stage. On reconfig the `prices` buffer
// carries forward but `drawdowns` is cleared and re-derived (each
// drawdown is per-period). Effective re-warmup margin is therefore
// up to `2 * newPeriod` post-resume bars.
describeContract<number | null, UlcerIndexState>({
  name: "ulcerIndex",
  create: (opts, warmUp) =>
    createUlcerIndex(opts as { period?: number; source?: "close" | "high" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 14, source: "close" },
  reconfigParams: [{ period: 7 }, { period: 28 }],
  // Two-stage warmup: prices buffer + drawdowns buffer. After reconfig
  // both must re-fill before the resumed series matches a fresh run.
  // `2 * newPeriod` is the safe upper bound (worst case: oldPeriod=0).
  reconfigMargin: (newOpts) => 2 * (newOpts.period as number),
  makeCandles,
  streamLength: 200,
  batchCompute: (opts, candles) =>
    ulcerIndex(candles, opts as { period?: number; source?: "close" | "high" }).map((s) => s.value),
});

// TWAP — Recursive (`cumTp` accumulator with session-boundary resets;
// no raw-price window to carry forward). Any `sessionResetPeriod`
// change throws via the recursive policy.
describeContract<number | null, TwapState>({
  name: "twap",
  create: (opts, warmUp) => createTwap(opts as { sessionResetPeriod?: "session" | number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { sessionResetPeriod: "session" },
  // Exercise both directions: switch to a numeric session AND between
  // two different numeric sessions.
  reconfigParams: [{ sessionResetPeriod: 60 }, { sessionResetPeriod: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    twap(candles, opts as { sessionResetPeriod?: "session" | number }).map((s) => s.value),
});

// ---- Bundle B: Standard Deviation / VWAP ----

// Standard Deviation — Windowed, same defaultless-period pattern as
// SMA / WMA / VWMA. Buffer carries forward on reconfig; sum / sumSq
// are recomputed from the carried samples.
describeContract<number | null, StandardDeviationState>({
  name: "standardDeviation",
  create: (opts, warmUp) =>
    createStandardDeviation(opts as { period?: number; source?: "close" | "high" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    standardDeviation(candles, opts as { period: number; source?: "close" | "high" }).map(
      (s) => s.value,
    ),
});

// VWAP — Recursive, parameter-less (daily session reset is the only
// "reconfig" knob and it's hardcoded). `meta.params` is always `{}`,
// so reconfig is structurally impossible and the recursive-refuse
// invariant is skipped via an empty `reconfigParams`. The remaining
// invariants (round-trip, name guard, version guard, peek, warmup)
// still cover the meaningful contract surface.
describeContract<VwapValueWithFlatField, VwapState>({
  name: "vwap",
  // describeContract compares values via `expectValueEqual` which
  // recurses into nested object keys, so the `{ vwap: ... }` output
  // works without flattening.
  create: (opts, warmUp) => createVwap(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  // Batch VWAP emits a richer composite (`{ vwap, upper, lower }`)
  // because it supports band multipliers; the incremental factory
  // here is session-only and only tracks the vwap field. Project
  // just `.vwap` for the parity comparison.
  batchCompute: (_opts, candles) => vwap(candles, {}).map((s) => ({ vwap: s.value.vwap })),
});

// Local alias so the `describeContract<TValue, TState>` generic captures
// the composite VWAP value type without polluting public exports.
type VwapValueWithFlatField = { vwap: number | null };

// ---- Bundle C: Donchian Channel / Anchored VWAP ----

// Donchian Channel — Windowed, same defaultless-period pattern as
// SMA / WMA / VWMA / SD. high/low buffers carry forward as raw values.
describeContract<DonchianValueShape, DonchianState>({
  name: "donchianChannel",
  create: (opts, warmUp) => createDonchianChannel(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20 },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    donchianChannel(candles, opts as { period?: number }).map((s) => s.value),
});

type DonchianValueShape = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
};

// Anchored VWAP — Recursive (cumulative TPV/volume accumulators from
// a fixed anchor time). Any `anchorTime` or `bands` change throws via
// the recursive policy.
//
// `anchorTime: 1700000000000` matches the start of `makeCandles`, so
// the indicator anchors on the first candle and produces a non-null
// value immediately (satisfying invariant [7]).
describeContract<AnchoredVwapValueShape, AnchoredVwapState>({
  name: "anchoredVwap",
  create: (opts, warmUp) =>
    createAnchoredVwap(opts as { anchorTime?: number; bands?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { anchorTime: 1700000000000, bands: 0 },
  // Exercise refuse on both anchor and band changes.
  reconfigParams: [{ anchorTime: 1700000000000 + 5 * 86400000 }, { bands: 1 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    anchoredVwap(candles, opts as { anchorTime: number; bands?: number }).map((s) => s.value),
});

type AnchoredVwapValueShape = {
  vwap: number | null;
  upper1?: number | null;
  lower1?: number | null;
  upper2?: number | null;
  lower2?: number | null;
};

// ---- Bundle D (Wave 1 final): Returns / HighestLowest ----

// Returns — Windowed, canonical defaults (period=1, type="simple"
// match pandas / quantstats convention). The close buffer carries
// forward as raw values across both period AND type changes — `type`
// only affects the formula, not the buffered data.
describeContract<number | null, ReturnsState>({
  name: "returns",
  create: (opts, warmUp) =>
    createReturns(opts as { period?: number; type?: "simple" | "log" }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 1, type: "simple" },
  reconfigParams: [{ period: 5 }, { period: 10 }, { type: "log" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    returnsBatch(candles, opts as { period?: number; type?: "simple" | "log" }).map((s) => s.value),
});

// HighestLowest — Windowed, same shape as Donchian's high/low buffers.
// `period` carries forward as raw high/low values.
describeContract<HighestLowestValueShape, HighestLowestState>({
  name: "highestLowest",
  create: (opts, warmUp) => createHighestLowest(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20 },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 100,
  // Batch has separate `highest()` and `lowest()` helpers; combine
  // them per-bar to match the incremental composite output.
  batchCompute: (opts, candles) => {
    const period = (opts.period as number) ?? 20;
    const h = highest(candles, period);
    const l = lowest(candles, period);
    return h.map((s, i) => ({ highest: s.value, lowest: l[i].value }));
  },
});

type HighestLowestValueShape = {
  highest: number | null;
  lowest: number | null;
};

// ---- Wave 2 Bundle E: OBV / PVT / NVI / ADL / CVD (pure accumulators) ----

// All five are Recursive (cumulative accumulators with no raw-price
// window). OBV / PVT / ADL / CVD are parameter-less, so `meta.params`
// is always `{}` and the recursive-refuse path is structurally
// unreachable — `reconfigParams: []` skips invariant [5] for them.
// NVI carries `initialValue` in `meta.params` and exercises the
// refuse path with a different seed.

// OBV — Recursive, parameter-less.
describeContract<number, ObvState>({
  name: "obv",
  create: (opts, warmUp) => createObv(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (_opts, candles) => obv(candles).map((s) => s.value),
});

// PVT — Recursive, parameter-less.
describeContract<number | null, PvtState>({
  name: "pvt",
  create: (opts, warmUp) => createPvt(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (_opts, candles) => pvt(candles).map((s) => s.value),
});

// NVI — Recursive with one param (`initialValue`). Exercises the
// recursive-refuse path: resuming under a different seed throws
// because the running `nviValue` is already scaled to the original
// seed.
describeContract<number, NviState>({
  name: "nvi",
  create: (opts, warmUp) => createNvi(opts as { initialValue?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { initialValue: 1000 },
  reconfigParams: [{ initialValue: 5000 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    nvi(candles, opts as { initialValue?: number }).map((s) => s.value),
});

// ADL — Recursive, parameter-less.
describeContract<number, AdlState>({
  name: "adl",
  create: (opts, warmUp) => createAdl(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (_opts, candles) => adl(candles).map((s) => s.value),
});

// CVD — Recursive, parameter-less.
describeContract<number, CvdState>({
  name: "cvd",
  create: (opts, warmUp) => createCvd(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (_opts, candles) => cvd(candles).map((s) => s.value),
});

// ---- Wave 2 Bundle F: McGinley Dynamic / EWMA Volatility ----

// McGinley Dynamic — Recursive (single-pole). `prevMd` permanently
// encodes past parameters, so reconfig (different period / k / source)
// is refused. Replaces the hand-rolled Phase 2C resume guard.
describeContract<number | null, McGinleyDynamicState>({
  name: "mcginleyDynamic",
  create: (opts, warmUp) =>
    createMcGinleyDynamic(opts as { period?: number; k?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 14, k: 0.6, source: "close" },
  // Exercise refuse on each independent param axis.
  reconfigParams: [{ period: 20 }, { k: 0.5 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    mcginleyDynamic(candles, opts as { period?: number; k?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// EWMA Volatility — Recursive (`prevVariance` is the recursive
// accumulator after seed completion; the seeding buffer is transient).
// Param mismatch on resume is now refused via the recursive policy —
// pre-0.4.0 silently merged with the snapshot's variance.
//
// Stream must clear the seed window (default seedSize=10 returns
// → seed completes at candle 10) before invariant [1]'s split point
// has any post-resume non-null bars to compare. `streamLength: 100`
// with `splitIdx = 50` gives plenty of room.
describeContract<number | null, EwmaVolatilityState>({
  name: "ewmaVolatility",
  create: (opts, warmUp) =>
    createEwmaVolatility(
      opts as { lambda?: number; source?: PriceSource; seedSize?: number },
      warmUp,
    ),
  category: "recursive",
  version: 1,
  defaultParams: { lambda: 0.94, source: "close", seedSize: 10 },
  reconfigParams: [{ lambda: 0.97 }, { seedSize: 20 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  // EWMA is the trickiest parity case in the library:
  //   * batch (`ewmaVolatilityFromCandles`) returns one entry per
  //     *return*, omitting candle 0; the incremental candle index i
  //     corresponds to batch index i-1.
  //   * batch uses a non-causal lookahead seed (sample variance of
  //     the first `seedSize` returns), so its early values rely on
  //     data the incremental indicator does not have yet during the
  //     seed window. We mask candles 0..seedSize-1 to null on the
  //     batch side to match the incremental's null seed gate; from
  //     candle `seedSize` onward both indicators evolve bar-for-bar
  //     identically (see ewma-volatility.ts file-level JSDoc for
  //     the matching replay logic on the incremental side).
  batchCompute: (opts, candles) => {
    const seedSize = (opts.seedSize as number) ?? 10;
    const result = ewmaVolatilityFromCandles(
      candles,
      opts as { lambda?: number; source?: PriceSource },
    );
    const padded: (number | null)[] = new Array(candles.length).fill(null);
    // result[i] is at candles[i+1].time; first non-masked entry is at
    // result[seedSize-1] (= candles[seedSize]).
    for (let i = seedSize - 1; i < result.length; i++) {
      padded[i + 1] = result[i].value;
    }
    return padded;
  },
});
