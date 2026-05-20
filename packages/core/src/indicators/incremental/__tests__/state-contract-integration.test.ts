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

import { describe, expect, it } from "vitest";
import { CRYPTO_CALENDAR, JPX_CALENDAR } from "../../../calendar";
import type { NormalizedCandle, PriceSource } from "../../../types";
import { adxr } from "../../momentum/adxr";
import { cmo } from "../../momentum/cmo";
import { connorsRsi } from "../../momentum/connors-rsi";
import { dmi } from "../../momentum/dmi";
import { massIndex } from "../../momentum/mass-index";
import { rsi } from "../../momentum/rsi";
import { stochRsi } from "../../momentum/stoch-rsi";
import { trix } from "../../momentum/trix";
import { tsi } from "../../momentum/tsi";
import { alma } from "../../moving-average/alma";
import { dema } from "../../moving-average/dema";
import { ema } from "../../moving-average/ema";
import { emaRibbon } from "../../moving-average/ema-ribbon";
import { mcginleyDynamic } from "../../moving-average/mcginley-dynamic";
import { sma } from "../../moving-average/sma";
import { t3 } from "../../moving-average/t3";
import { tema } from "../../moving-average/tema";
import { vwma } from "../../moving-average/vwma";
import { wma } from "../../moving-average/wma";
import { zlema } from "../../moving-average/zlema";
import { highest, lowest } from "../../price/highest-lowest";
import { returns as returnsBatch } from "../../price/returns";
import { atr } from "../../volatility/atr";
import { choppinessIndex } from "../../volatility/choppiness-index";
import { donchianChannel } from "../../volatility/donchian-channel";
import { ewmaVolatilityFromCandles } from "../../volatility/garch";
import { keltnerChannel } from "../../volatility/keltner-channel";
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
import { type AdxrState, createAdxr } from "../momentum/adxr";
import { type CmoState, createCmo } from "../momentum/cmo";
import {
  type ConnorsRsiState,
  type ConnorsRsiValue,
  createConnorsRsi,
} from "../momentum/connors-rsi";
import { createDmi, type DmiState, type DmiValue } from "../momentum/dmi";
import { createMassIndex, type MassIndexState } from "../momentum/mass-index";
import { createRsi, type RsiState } from "../momentum/rsi";
import { createStochRsi, type StochRsiState, type StochRsiValue } from "../momentum/stoch-rsi";
import { createTrix, type TrixState, type TrixValue } from "../momentum/trix";
import { createTsi, type TsiState, type TsiValue } from "../momentum/tsi";
import { type AlmaState, createAlma } from "../moving-average/alma";
import { createDema, type DemaState } from "../moving-average/dema";
import { createEma, type EmaState } from "../moving-average/ema";
import {
  createEmaRibbon,
  type EmaRibbonState,
  type EmaRibbonValue,
} from "../moving-average/ema-ribbon";
import {
  createMcGinleyDynamic,
  type McGinleyDynamicState,
} from "../moving-average/mcginley-dynamic";
import { createSma, type SmaState } from "../moving-average/sma";
import { createT3, type T3State } from "../moving-average/t3";
import { createTema, type TemaState } from "../moving-average/tema";
import { createVwma, type VwmaState } from "../moving-average/vwma";
import { createWma, type WmaState } from "../moving-average/wma";
import { createZlema, type ZlemaState } from "../moving-average/zlema";
import { createHighestLowest, type HighestLowestState } from "../price/highest-lowest";
import { createReturns, type ReturnsState } from "../price/returns";
import { type AtrState, createAtr } from "../volatility/atr";
import { type ChoppinessIndexState, createChoppinessIndex } from "../volatility/choppiness-index";
import { createDonchianChannel, type DonchianState } from "../volatility/donchian-channel";
import { createEwmaVolatility, type EwmaVolatilityState } from "../volatility/ewma-volatility";
import {
  createKeltnerChannel,
  type KeltnerChannelState,
  type KeltnerChannelValue,
} from "../volatility/keltner-channel";
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
  // EWMA's output is annualized volatility (%) — typical magnitudes
  // 10..60. The default 1e-10 absolute tolerance is ~1e-12 relative
  // and trips on any future tweak to summation order (e.g., log-return
  // clipping). Loosen to 1e-9 absolute (~1e-11 relative): still well
  // below any meaningful divergence, but stable against benign FP
  // reordering. Tighten if any test failure here ever surfaces a real
  // algorithmic gap.
  consistencyTolerance: 1e-9,
});

// EWMA parity at non-default params (lambda=0.97 — RiskMetrics monthly
// convention; periodsPerYear=365 — crypto). Both flows must remain
// bar-for-bar identical to batch when these options are passed; before
// the Bundle G annualization fix the latter silently diverged because
// incremental hard-coded sqrt(252). These extra contract entries lock
// the API parity in regardless of `defaultParams`.
describeContract<number | null, EwmaVolatilityState>({
  name: "ewmaVolatility (lambda=0.97)",
  create: (opts, warmUp) =>
    createEwmaVolatility(
      opts as { lambda?: number; source?: PriceSource; seedSize?: number },
      warmUp,
    ),
  category: "recursive",
  version: 1,
  defaultParams: { lambda: 0.97, source: "close", seedSize: 10 },
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => {
    const seedSize = (opts.seedSize as number) ?? 10;
    const result = ewmaVolatilityFromCandles(
      candles,
      opts as { lambda?: number; source?: PriceSource },
    );
    const padded: (number | null)[] = new Array(candles.length).fill(null);
    for (let i = seedSize - 1; i < result.length; i++) {
      padded[i + 1] = result[i].value;
    }
    return padded;
  },
  consistencyTolerance: 1e-9,
});

describeContract<number | null, EwmaVolatilityState>({
  name: "ewmaVolatility (crypto: periodsPerYear=365)",
  create: (opts, warmUp) =>
    createEwmaVolatility(
      opts as {
        lambda?: number;
        source?: PriceSource;
        seedSize?: number;
        periodsPerYear?: number;
      },
      warmUp,
    ),
  category: "recursive",
  version: 1,
  defaultParams: { lambda: 0.94, source: "close", seedSize: 10, periodsPerYear: 365 },
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => {
    const seedSize = (opts.seedSize as number) ?? 10;
    const result = ewmaVolatilityFromCandles(
      candles,
      opts as { lambda?: number; source?: PriceSource; periodsPerYear?: number },
    );
    const padded: (number | null)[] = new Array(candles.length).fill(null);
    for (let i = seedSize - 1; i < result.length; i++) {
      padded[i + 1] = result[i].value;
    }
    return padded;
  },
  consistencyTolerance: 1e-9,
});

// Calendar input must work without breaking `getState()`. `TradingCalendar`
// carries an optional `isTradingDay?(date)` predicate; if it leaked into
// `meta.params` the snapshot deep-clone (`structuredClone` /
// JSON round-trip) would throw `DataCloneError` or silently drop the
// function. The constructor resolves `calendar` → numeric
// `periodsPerYear` *before* snapshotting, so this scenario must produce
// a JSON-safe snapshot and resume cleanly to the same numeric factor.
describe("EWMA Volatility — calendar input round-trip", () => {
  const candles = makeCandles(60);

  it("calendar input resolves to numeric periodsPerYear and snapshots safely", () => {
    const ind = createEwmaVolatility({ calendar: JPX_CALENDAR });
    for (const c of candles) ind.next(c);
    const snapshot = ind.getState();

    // Snapshot must be JSON-serializable (no functions leaked through).
    expect(() => JSON.parse(JSON.stringify(snapshot))).not.toThrow();
    expect(snapshot.meta.params.periodsPerYear).toBe(JPX_CALENDAR.tradingDaysPerYear);
    expect("calendar" in snapshot.meta.params).toBe(false);
  });

  it("calendar with custom isTradingDay function still produces a JSON-safe snapshot", () => {
    const customCalendar = {
      name: "custom",
      tradingDaysPerYear: 250,
      isTradingDay: (_d: Date) => true,
    };
    const ind = createEwmaVolatility({ calendar: customCalendar });
    for (const c of candles) ind.next(c);
    const snapshot = ind.getState();

    // The function must NOT leak into params — JSON round-trip would
    // throw or silently drop it otherwise.
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped.meta.params.periodsPerYear).toBe(250);
    expect(roundTripped.meta.params.calendar).toBeUndefined();
  });

  it("resume with periodsPerYear matches resume with equivalent calendar", () => {
    const ind = createEwmaVolatility({ calendar: JPX_CALENDAR });
    for (const c of candles) ind.next(c);
    const snapshot = ind.getState();

    // Both forms must resolve to the same numeric factor and not trip
    // the recursive-refuse policy.
    expect(() =>
      createEwmaVolatility({ calendar: JPX_CALENDAR }, { fromState: snapshot }),
    ).not.toThrow();
    expect(() =>
      createEwmaVolatility(
        { periodsPerYear: JPX_CALENDAR.tradingDaysPerYear },
        { fromState: snapshot },
      ),
    ).not.toThrow();
  });

  it("resume with different calendar (different tradingDaysPerYear) is refused", () => {
    const ind = createEwmaVolatility({ calendar: JPX_CALENDAR });
    for (const c of candles) ind.next(c);
    const snapshot = ind.getState();

    expect(() =>
      createEwmaVolatility({ calendar: CRYPTO_CALENDAR }, { fromState: snapshot }),
    ).toThrow(/periodsPerYear|incompatible snapshot/);
  });

  it("legacy snapshot without periodsPerYear key resumes cleanly across the API change", () => {
    // Initial Bundle F migration persisted `meta.params = {lambda,
    // source, seedSize}` (no `periodsPerYear` key) and hard-coded
    // sqrt(252) at compute time. After the annualization audit fix,
    // snapshots always persist a numeric `periodsPerYear`. A caller
    // holding such a *legacy-shape* snapshot must still be able to
    // resume with `{ periodsPerYear: 252 }` (or US-equity calendar)
    // without the recursive-refuse policy tripping. The constructor
    // materializes the implicit 252 into the legacy snapshot before
    // diff time; verify that explicit equivalent options no longer
    // throw on this upgrade path.
    const fresh = createEwmaVolatility({});
    for (const c of candles) fresh.next(c);
    const cur = fresh.getState();
    // Strip `periodsPerYear` to simulate a snapshot saved by the
    // pre-audit Bundle F code.
    const { periodsPerYear: _ignored, ...legacyParams } = cur.meta.params as Record<
      string,
      unknown
    >;
    const legacySnapshot = {
      meta: { ...cur.meta, params: legacyParams },
      state: cur.state,
    } as typeof cur;

    expect("periodsPerYear" in legacySnapshot.meta.params).toBe(false);

    // Explicit equivalent must NOT throw.
    expect(() =>
      createEwmaVolatility({ periodsPerYear: 252 }, { fromState: legacySnapshot }),
    ).not.toThrow();
    const usEquityLike = { name: "test", tradingDaysPerYear: 252 };
    expect(() =>
      createEwmaVolatility({ calendar: usEquityLike }, { fromState: legacySnapshot }),
    ).not.toThrow();

    // Non-equivalent explicit (different factor) must still throw —
    // legacy assumed 252, options says 365, that's a real change.
    expect(() =>
      createEwmaVolatility({ periodsPerYear: 365 }, { fromState: legacySnapshot }),
    ).toThrow(/periodsPerYear|incompatible snapshot/);
  });

  it("implicit-default snapshot resumes cleanly with the equivalent explicit option", () => {
    // A snapshot built with no annualization option must accept
    // resume with `periodsPerYear: 252` (or US_EQUITY_CALENDAR whose
    // tradingDaysPerYear is also 252) — the effective factor is
    // identical, so the recursive-refuse policy must not trip.
    // Earlier the snapshot omitted `periodsPerYear` on the
    // implicit-default path; resolveResume then saw "added param"
    // when the resume supplied the equivalent number and refused.
    const ind = createEwmaVolatility({});
    for (const c of candles) ind.next(c);
    const snapshot = ind.getState();

    expect(snapshot.meta.params.periodsPerYear).toBe(252);
    expect(() =>
      createEwmaVolatility({ periodsPerYear: 252 }, { fromState: snapshot }),
    ).not.toThrow();
    // 252-day calendar (US equity) must also be accepted as equivalent.
    const usEquityLike = { name: "test", tradingDaysPerYear: 252 };
    expect(() =>
      createEwmaVolatility({ calendar: usEquityLike }, { fromState: snapshot }),
    ).not.toThrow();
  });

  it("when both calendar and periodsPerYear are supplied, calendar wins (matches batch)", () => {
    // Batch `annualizationFactor` returns `calendar.tradingDaysPerYear`
    // whenever a calendar is present, regardless of `periodsPerYear`.
    // Incremental must match — otherwise a caller passing the
    // conflicting pair gets different volatility scales between the
    // two APIs. Snapshot must persist the calendar's number (245),
    // not the periodsPerYear override (365).
    const withBoth = createEwmaVolatility({
      calendar: JPX_CALENDAR, // tradingDaysPerYear = 245 — must win
      periodsPerYear: 365, // would shadow calendar if precedence were inverted
    });
    const calendarOnly = createEwmaVolatility({ calendar: JPX_CALENDAR });
    for (const c of candles) {
      withBoth.next(c);
      calendarOnly.next(c);
    }
    const last = candles[candles.length - 1];
    expect(withBoth.peek(last).value).toBe(calendarOnly.peek(last).value);
    expect(withBoth.getState().meta.params.periodsPerYear).toBe(JPX_CALENDAR.tradingDaysPerYear);
  });
});

// ---- Wave 2 Bundle G: EMA ----

// EMA — Recursive (single-pole). `prevEma` permanently encodes its
// construction-time `period` and `source`, so any param change on
// resume is mathematically undefined and refused by the recursive
// policy. The bare state shrinks from 6 fields (period / source /
// multiplier / prevEma / sum / count) to just the 3 runtime values
// (prevEma / sum / count); multiplier is derived from `period` in
// the factory closure.
//
// EMA is the most widely-used moving average and is internally
// composed by DEMA, TEMA, T3, EMA Ribbon, TRIX, TSI, Mass Index,
// and Keltner Channel — all 8 consumers cascade through the
// `EmaState → IndicatorSnapshot<EmaState>` type rename in their
// bare-state field declarations. They remain opaque pass-throughs
// (snapshot in, snapshot out) so their `next()` / `peek()` /
// computation paths are byte-identical to 0.3.x.
describeContract<number | null, EmaState>({
  name: "ema",
  create: (opts, warmUp) => createEma(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  // Exercise refuse on both independent param axes.
  reconfigParams: [{ period: 10 }, { period: 30 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    ema(candles, opts as { period: number; source?: PriceSource }).map((s) => s.value),
});

// ---- Wave 2 Bundle H: ZLEMA ----

// ZLEMA — Recursive (single-pole on adjusted price). `prevZlema`
// carries the recursion; the fixed-size lag lookback ring buffer
// (capacity = `floor((period - 1) / 2) + 1`) and `seedSum` /
// `seedCount` together form the warmup tally consumed once the SMA
// seed completes. Both the recursive accumulator and the lag-window
// contents are permanently conditioned on construction-time `period`
// and `source`, so any param change on resume is mathematically
// undefined and refused by the recursive policy. The bare state
// shrinks by removing the persisted `period` / `source` / `lag` /
// `multiplier` fields (now in `meta.params` / derived in the factory
// closure); `prevZlema` / `seedSum` / `seedCount` / `buffer` / `count`
// remain on the wire.
describeContract<number | null, ZlemaState>({
  name: "zlema",
  create: (opts, warmUp) => createZlema(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  // Exercise refuse on both independent param axes.
  reconfigParams: [{ period: 10 }, { period: 30 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    zlema(candles, opts as { period: number; source?: PriceSource }).map((s) => s.value),
});

// ---- Wave 3 Bundle I: Cascaded EMA wrappers ----
//
// All seven entries below compose the migrated EMA factory (Bundle G).
// Bare state holds only the inner EMA snapshots plus per-wrapper
// accumulators (`prevSpread`, `prevEma3`, `prevPrice`, `ratioBuffer`,
// etc.). Params live in `meta.params`. Resume with mismatched params
// throws via the cascaded / mixed policy. `batchCompute` pins
// invariant [8] across trending / flat / gap candle variants.

// DEMA — Cascaded (2 EMAs). DEMA = 2 * EMA1 - EMA2.
describeContract<number | null, DemaState>({
  name: "dema",
  create: (opts, warmUp) => createDema(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    dema(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// TEMA — Cascaded (3 EMAs). TEMA = 3 * EMA1 - 3 * EMA2 + EMA3.
describeContract<number | null, TemaState>({
  name: "tema",
  create: (opts, warmUp) => createTema(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    tema(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// T3 (Tillson) — Cascaded (6 EMAs + volume factor coefficients).
describeContract<number | null, T3State>({
  name: "t3",
  create: (opts, warmUp) =>
    createT3(opts as { period?: number; vFactor?: number; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 5, vFactor: 0.7, source: "close" },
  reconfigParams: [{ period: 8 }, { period: 10 }, { vFactor: 0.5 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    t3(candles, opts as { period?: number; vFactor?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// EMA Ribbon — Cascaded (parallel EMAs over the same input).
// `periods` is an array key; the inner EMAs are sorted ascending by
// period. `bullish` / `expanding` are derived from the composite values.
//
// The value object is never literally `null`: warmup bars emit
// `{ values: [null, …], bullish: null, expanding: null }`. The default
// `isNullishValue` predicate treats the embedded `values` array as a
// non-null leaf so it would mis-classify warmup bars as warmed up.
// Override with a predicate that treats the bar as nullish until
// `bullish` is computed — that matches the indicator's `isWarmedUp`
// (slowest EMA done warming).
describeContract<EmaRibbonValue, EmaRibbonState>({
  name: "emaRibbon",
  create: (opts, warmUp) =>
    createEmaRibbon(opts as { periods?: number[]; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { periods: [8, 13, 21, 34, 55], source: "close" },
  reconfigParams: [{ periods: [5, 10, 20] }, { periods: [8, 21, 55] }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { bullish: unknown }).bullish === null),
  batchCompute: (opts, candles) =>
    emaRibbon(candles, opts as { periods?: number[]; source?: PriceSource }).map((s) => s.value),
});

// Regression: EMA Ribbon has always treated `periods` as
// order-insensitive (batch `emaRibbon([10, 3, 5])` sorts internally).
// The Bundle I migration originally compared the raw `options.periods`
// against the sorted `meta.params.periods`, causing resume with the
// same unsorted array to throw an incompatible-snapshot error. The fix
// normalizes `periods` before `resolveResume` so the resume path
// remains order-insensitive — pinned here so the regression cannot
// silently come back.
describe("emaRibbon: unsorted periods order-insensitive resume", () => {
  it("accepts resume when fromState was created with an unsorted periods array", () => {
    const candles = makeCandles(80);
    const seed = createEmaRibbon({ periods: [10, 3, 5] });
    for (const c of candles) seed.next(c);
    const snapshot = seed.getState();
    // Same array, same order — must not throw.
    expect(() => createEmaRibbon({ periods: [10, 3, 5] }, { fromState: snapshot })).not.toThrow();
    // Same set of periods in a different order — also must not throw.
    expect(() => createEmaRibbon({ periods: [5, 3, 10] }, { fromState: snapshot })).not.toThrow();
    expect(() => createEmaRibbon({ periods: [3, 5, 10] }, { fromState: snapshot })).not.toThrow();
  });

  it("still refuses resume when periods set actually differs", () => {
    const candles = makeCandles(80);
    const seed = createEmaRibbon({ periods: [10, 3, 5] });
    for (const c of candles) seed.next(c);
    const snapshot = seed.getState();
    expect(() => createEmaRibbon({ periods: [10, 3, 7] }, { fromState: snapshot })).toThrow();
    expect(() => createEmaRibbon({ periods: [10, 3] }, { fromState: snapshot })).toThrow();
  });
});

// TRIX — Cascaded (1 createEma stage + 3 internal null-propagating EMA
// stages). Composite output `{ trix, signal }`.
describeContract<TrixValue, TrixState>({
  name: "trix",
  create: (opts, warmUp) => createTrix(opts as { period?: number; signalPeriod?: number }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 15, signalPeriod: 9 },
  reconfigParams: [{ period: 10 }, { period: 20 }, { signalPeriod: 5 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    trix(candles, opts as { period?: number; signalPeriod?: number }).map((s) => s.value),
});

// TSI — Cascaded (5 EMAs over momentum / abs-momentum paths + signal
// line). Composite output `{ tsi, signal } | null`. `prevPrice`
// initializes the momentum recursion on the first candle.
describeContract<TsiValue | null, TsiState>({
  name: "tsi",
  create: (opts, warmUp) =>
    createTsi(
      opts as {
        longPeriod?: number;
        shortPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7, source: "close" },
  reconfigParams: [
    { longPeriod: 20 },
    { shortPeriod: 10 },
    { signalPeriod: 5 },
    { source: "high" },
  ],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    tsi(
      candles,
      opts as {
        longPeriod?: number;
        shortPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// Mass Index — Mixed (2 cascaded EMAs + a windowed ratio sum buffer).
// The mixed policy refuses any param change on resume.
describeContract<number | null, MassIndexState>({
  name: "massIndex",
  create: (opts, warmUp) =>
    createMassIndex(opts as { emaPeriod?: number; sumPeriod?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { emaPeriod: 9, sumPeriod: 25 },
  reconfigParams: [{ emaPeriod: 7 }, { sumPeriod: 20 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    massIndex(candles, opts as { emaPeriod?: number; sumPeriod?: number }).map((s) => s.value),
});

// ---- Wave 3 Bundle J: Wilder smoother cluster ----
//
// RSI / ATR / DMI / CMO are recursive (Wilder accumulators + warmup
// tally). ADXR / Keltner / StochRSI / Connors RSI compose them and are
// mixed. No standalone Wilder helper is extracted — the smoothing is a
// one-line expression and the seed phases / state shapes differ per
// indicator, so each is migrated independently. `batchCompute` pins
// invariant [8] across trending / flat / gap variants.

// RSI — Recursive (Wilder avgGain/avgLoss + initialGains/Losses tally).
describeContract<number | null, RsiState>({
  name: "rsi",
  create: (opts, warmUp) => createRsi(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 14, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 21 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    rsi(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// ATR — Recursive (Wilder TR smoother + trSum tally).
describeContract<number | null, AtrState>({
  name: "atr",
  create: (opts, warmUp) => createAtr(opts as { period?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 21 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => atr(candles, opts as { period?: number }).map((s) => s.value),
});

// DMI — Recursive. TR/DM use the sum-form Wilder smoother, ADX uses
// the average form. Composite output `{ plusDi, minusDi, adx }`; +DI
// emerges before ADX, so the null predicate gates on `adx` to align
// with `isWarmedUp` (= adx non-null).
describeContract<DmiValue, DmiState>({
  name: "dmi",
  create: (opts, warmUp) => createDmi(opts as { period?: number; adxPeriod?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 14, adxPeriod: 14 },
  reconfigParams: [{ period: 10 }, { adxPeriod: 21 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { adx: unknown }).adx === null),
  batchCompute: (opts, candles) =>
    dmi(candles, opts as { period?: number; adxPeriod?: number }).map((s) => s.value),
});

// CMO — Recursive (Wilder avgUp/avgDown + initialUps/Downs tally).
describeContract<number | null, CmoState>({
  name: "cmo",
  create: (opts, warmUp) => createCmo(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 14, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 21 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    cmo(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// ADXR — Mixed (inner DMI snapshot + windowed ADX lag-lookback buffer).
describeContract<number | null, AdxrState>({
  name: "adxr",
  create: (opts, warmUp) =>
    createAdxr(opts as { period?: number; dmiPeriod?: number; adxPeriod?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 14, dmiPeriod: 14, adxPeriod: 14 },
  reconfigParams: [{ period: 10 }, { dmiPeriod: 10 }, { adxPeriod: 21 }],
  makeCandles,
  streamLength: 140,
  batchCompute: (opts, candles) =>
    adxr(candles, opts as { period?: number; dmiPeriod?: number; adxPeriod?: number }).map(
      (s) => s.value,
    ),
});

// Keltner Channel — Mixed (inner EMA snapshot + inner ATR snapshot).
// Composite output; EMA and ATR warm up together (computeValue gates
// on both), so the default null predicate aligns with `isWarmedUp`.
//
// `emaPeriod` / `atrPeriod` are state-shaping → reconfig refused
// (invariant [5]). `multiplier` is resume-invariant (param-role axis)
// → it scales only the band width and is checked by invariant [9].
describeContract<KeltnerChannelValue, KeltnerChannelState>({
  name: "keltnerChannel",
  create: (opts, warmUp) =>
    createKeltnerChannel(
      opts as { emaPeriod?: number; atrPeriod?: number; multiplier?: number },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
  reconfigParams: [{ emaPeriod: 14 }, { atrPeriod: 14 }],
  resumeInvariantReconfig: [{ multiplier: 3 }, { multiplier: 1.5 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    keltnerChannel(
      candles,
      opts as { emaPeriod?: number; atrPeriod?: number; multiplier?: number },
    ).map((s) => s.value),
});

// StochRSI — Mixed (inline RSI accumulator + 3 windowed SMA buffers).
// Composite output `{ stochRsi, k, d }`; stochRsi emerges first, so the
// null predicate gates on `d` to align with `isWarmedUp`.
describeContract<StochRsiValue, StochRsiState>({
  name: "stochRsi",
  create: (opts, warmUp) =>
    createStochRsi(
      opts as {
        rsiPeriod?: number;
        stochPeriod?: number;
        kPeriod?: number;
        dPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3, source: "close" },
  reconfigParams: [{ rsiPeriod: 10 }, { stochPeriod: 10 }, { kPeriod: 5 }, { dPeriod: 5 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null || v === undefined || (typeof v === "object" && (v as { d: unknown }).d === null),
  batchCompute: (opts, candles) =>
    stochRsi(
      candles,
      opts as {
        rsiPeriod?: number;
        stochPeriod?: number;
        kPeriod?: number;
        dPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// Connors RSI — Mixed (2 inner RSI snapshots + windowed ROC buffer +
// streak tracker). The hand-written resume guard is replaced by the
// mixed-category resolveResume policy. Composite output; `crsi`
// emerges last, so the null predicate gates on it.
describeContract<ConnorsRsiValue, ConnorsRsiState>({
  name: "connorsRsi",
  create: (opts, warmUp) =>
    createConnorsRsi(
      opts as {
        rsiPeriod?: number;
        streakPeriod?: number;
        rocPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100, source: "close" },
  reconfigParams: [{ rsiPeriod: 5 }, { streakPeriod: 3 }, { rocPeriod: 50 }, { source: "high" }],
  makeCandles,
  streamLength: 140,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { crsi: unknown }).crsi === null),
  batchCompute: (opts, candles) =>
    connorsRsi(
      candles,
      opts as {
        rsiPeriod?: number;
        streakPeriod?: number;
        rocPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});
