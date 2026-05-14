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

import type { NormalizedCandle } from "../../../types";
import { type AlmaState, createAlma } from "../moving-average/alma";
import { createSma, type SmaState } from "../moving-average/sma";
import { createVwma, type VwmaState } from "../moving-average/vwma";
import { createWma, type WmaState } from "../moving-average/wma";
import { createHighestLowest, type HighestLowestState } from "../price/highest-lowest";
import { createReturns, type ReturnsState } from "../price/returns";
import { type ChoppinessIndexState, createChoppinessIndex } from "../volatility/choppiness-index";
import { createDonchianChannel, type DonchianState } from "../volatility/donchian-channel";
import {
  createStandardDeviation,
  type StandardDeviationState,
} from "../volatility/standard-deviation";
import { createUlcerIndex, type UlcerIndexState } from "../volatility/ulcer-index";
import { type AnchoredVwapState, createAnchoredVwap } from "../volume/anchored-vwap";
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
});

type HighestLowestValueShape = {
  highest: number | null;
  lowest: number | null;
};
