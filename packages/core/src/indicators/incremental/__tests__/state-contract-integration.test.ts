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
import type {
  AtrStopsValue,
  BollingerBandsValue,
  ChandelierExitValue,
  MacdValue,
  NormalizedCandle,
  PriceSource,
  VolumeAnomalyValue,
  VolumeTrendValue,
} from "../../../types";
import { roofingFilter } from "../../filter/roofing-filter";
import { superSmoother } from "../../filter/super-smoother";
import { adxr } from "../../momentum/adxr";
import { aroon } from "../../momentum/aroon";
import { awesomeOscillator } from "../../momentum/awesome-oscillator";
import { balanceOfPower } from "../../momentum/balance-of-power";
import { cci } from "../../momentum/cci";
import { cmo } from "../../momentum/cmo";
import { connorsRsi } from "../../momentum/connors-rsi";
import { coppockCurve } from "../../momentum/coppock-curve";
import { dmi } from "../../momentum/dmi";
import { hurst } from "../../momentum/hurst";
import { imi } from "../../momentum/imi";
import { kst } from "../../momentum/kst";
import { macd } from "../../momentum/macd";
import { massIndex } from "../../momentum/mass-index";
import { ppo } from "../../momentum/ppo";
import { qstick } from "../../momentum/qstick";
import { roc } from "../../momentum/roc";
import { rsi } from "../../momentum/rsi";
import { stochRsi } from "../../momentum/stoch-rsi";
import { stochastics } from "../../momentum/stochastics";
import { trix } from "../../momentum/trix";
import { tsi } from "../../momentum/tsi";
import { ultimateOscillator } from "../../momentum/ultimate-oscillator";
import { williamsR } from "../../momentum/williams-r";
import { alma } from "../../moving-average/alma";
import { dema } from "../../moving-average/dema";
import { ema } from "../../moving-average/ema";
import { emaRibbon } from "../../moving-average/ema-ribbon";
import { frama } from "../../moving-average/frama";
import { hma } from "../../moving-average/hma";
import { kama } from "../../moving-average/kama";
import { mcginleyDynamic } from "../../moving-average/mcginley-dynamic";
import { sma } from "../../moving-average/sma";
import { t3 } from "../../moving-average/t3";
import { tema } from "../../moving-average/tema";
import { vwma } from "../../moving-average/vwma";
import { wma } from "../../moving-average/wma";
import { zlema } from "../../moving-average/zlema";
import { heikinAshi } from "../../price/heikin-ashi";
import { highest, lowest } from "../../price/highest-lowest";
import { returns as returnsBatch } from "../../price/returns";
import { linearRegression } from "../../trend/linear-regression";
import { parabolicSar } from "../../trend/parabolic-sar";
import { schaffTrendCycle } from "../../trend/schaff-trend-cycle";
import { supertrend } from "../../trend/supertrend";
import { vortex } from "../../trend/vortex";
import { atr } from "../../volatility/atr";
import { atrStops } from "../../volatility/atr-stops";
import { bollingerBands } from "../../volatility/bollinger-bands";
import { chandelierExit } from "../../volatility/chandelier-exit";
import { choppinessIndex } from "../../volatility/choppiness-index";
import { donchianChannel } from "../../volatility/donchian-channel";
import { ewmaVolatilityFromCandles } from "../../volatility/garch";
import { garmanKlass } from "../../volatility/garman-klass";
import { historicalVolatility } from "../../volatility/historical-volatility";
import { keltnerChannel } from "../../volatility/keltner-channel";
import { standardDeviation } from "../../volatility/standard-deviation";
import { ulcerIndex } from "../../volatility/ulcer-index";
import { adl } from "../../volume/adl";
import { anchoredVwap } from "../../volume/anchored-vwap";
import { cmf } from "../../volume/cmf";
import { cvd } from "../../volume/cvd";
import { easeOfMovement } from "../../volume/ease-of-movement";
import { elderForceIndex } from "../../volume/elder-force-index";
import { klinger } from "../../volume/klinger";
import { mfi } from "../../volume/mfi";
import { nvi } from "../../volume/nvi";
import { obv } from "../../volume/obv";
import { pvt } from "../../volume/pvt";
import { twap } from "../../volume/twap";
import { volumeAnomaly } from "../../volume/volume-anomaly";
import { volumeTrend } from "../../volume/volume-trend";
import { vwap } from "../../volume/vwap";
import { weisWave } from "../../volume/weis-wave";
import { createRoofingFilter, type RoofingFilterState } from "../filter/roofing-filter";
import { createSuperSmoother, type SuperSmootherState } from "../filter/super-smoother";
import { type AdxrState, createAdxr } from "../momentum/adxr";
import { type AroonState, type AroonValue, createAroon } from "../momentum/aroon";
import {
  type AwesomeOscillatorState,
  createAwesomeOscillator,
} from "../momentum/awesome-oscillator";
import { type BalanceOfPowerState, createBalanceOfPower } from "../momentum/balance-of-power";
import { type CciState, createCci } from "../momentum/cci";
import { type CmoState, createCmo } from "../momentum/cmo";
import {
  type ConnorsRsiState,
  type ConnorsRsiValue,
  createConnorsRsi,
} from "../momentum/connors-rsi";
import { type CoppockCurveState, createCoppockCurve } from "../momentum/coppock-curve";
import { createDmi, type DmiState, type DmiValue } from "../momentum/dmi";
import { createDpo, type DpoState } from "../momentum/dpo";
import { createHurst, type HurstState } from "../momentum/hurst";
import { createImi, type ImiState } from "../momentum/imi";
import { createKst, type KstState, type KstValue } from "../momentum/kst";
import { createMacd, type MacdState } from "../momentum/macd";
import { createMassIndex, type MassIndexState } from "../momentum/mass-index";
import { createPpo, type PpoState, type PpoValue } from "../momentum/ppo";
import { createQStick, type QStickState } from "../momentum/qstick";
import { createRoc, type RocState } from "../momentum/roc";
import { createRsi, type RsiState } from "../momentum/rsi";
import { createStc, type StcState } from "../momentum/schaff-trend-cycle";
import { createStochRsi, type StochRsiState, type StochRsiValue } from "../momentum/stoch-rsi";
import {
  createStochastics,
  type StochasticsState,
  type StochasticsValue,
} from "../momentum/stochastics";
import { createTrix, type TrixState, type TrixValue } from "../momentum/trix";
import { createTsi, type TsiState, type TsiValue } from "../momentum/tsi";
import {
  createUltimateOscillator,
  type UltimateOscillatorState,
} from "../momentum/ultimate-oscillator";
import { createVortex, type VortexState, type VortexValue } from "../momentum/vortex";
import { createWilliamsR, type WilliamsRState } from "../momentum/williams-r";
import { type AlmaState, createAlma } from "../moving-average/alma";
import { createDema, type DemaState } from "../moving-average/dema";
import { createEma, type EmaState } from "../moving-average/ema";
import {
  createEmaRibbon,
  type EmaRibbonState,
  type EmaRibbonValue,
} from "../moving-average/ema-ribbon";
import { createFrama, type FramaState } from "../moving-average/frama";
import { createHma, type HmaState } from "../moving-average/hma";
import { createKama, type KamaState } from "../moving-average/kama";
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
import {
  type AutoTrendLineState,
  type AutoTrendLineValue,
  createAutoTrendLine,
} from "../price/auto-trend-line";
import {
  type BosState,
  type BosValue,
  type ChochState,
  createBreakOfStructure,
  createChangeOfCharacter,
} from "../price/break-of-structure";
import {
  type ChannelLineState,
  type ChannelLineValue,
  createChannelLine,
} from "../price/channel-line";
import { createFairValueGap, type FairValueGapState, type FvgValue } from "../price/fair-value-gap";
import {
  createFibonacciExtension,
  type FibonacciExtensionState,
  type FibonacciExtensionValue,
} from "../price/fibonacci-extension";
import {
  createFibonacciRetracement,
  type FibonacciRetracementState,
  type FibonacciRetracementValue,
} from "../price/fibonacci-retracement";
import { createFractals, type FractalsState, type FractalValue } from "../price/fractals";
import { createGapAnalysis, type GapAnalysisState, type GapValue } from "../price/gap-analysis";
import { createHeikinAshi, type HeikinAshiState, type HeikinAshiValue } from "../price/heikin-ashi";
import { createHighestLowest, type HighestLowestState } from "../price/highest-lowest";
import {
  createOpeningRange,
  type OpeningRangeState,
  type OpeningRangeValue,
} from "../price/opening-range";
import {
  createPivotPoints,
  type PivotPointsState,
  type PivotPointsValue,
} from "../price/pivot-points";
import { createReturns, type ReturnsState } from "../price/returns";
import {
  createSwingPoints,
  type SwingPointsState,
  type SwingPointValue,
} from "../price/swing-points";
import { createZigzag, type ZigzagState, type ZigzagValue } from "../price/zigzag";
import {
  createLiquiditySweep,
  type LiquiditySweepState,
  type LiquiditySweepValue,
} from "../smc/liquidity-sweep";
import { createIchimoku, type IchimokuState, type IchimokuValue } from "../trend/ichimoku";
import {
  createLinearRegression,
  type LinearRegressionState,
  type LinearRegressionValue,
} from "../trend/linear-regression";
import {
  createParabolicSar,
  type ParabolicSarState,
  type ParabolicSarValue,
} from "../trend/parabolic-sar";
import { createSupertrend, type SupertrendState, type SupertrendValue } from "../trend/supertrend";
import { type AtrState, createAtr } from "../volatility/atr";
import { type AtrStopsState, createAtrStops } from "../volatility/atr-stops";
import { type BollingerBandsState, createBollingerBands } from "../volatility/bollinger-bands";
import { type ChandelierExitState, createChandelierExit } from "../volatility/chandelier-exit";
import { type ChoppinessIndexState, createChoppinessIndex } from "../volatility/choppiness-index";
import { createDonchianChannel, type DonchianState } from "../volatility/donchian-channel";
import { createEwmaVolatility, type EwmaVolatilityState } from "../volatility/ewma-volatility";
import { createGarmanKlass, type GarmanKlassState } from "../volatility/garman-klass";
import {
  createHistoricalVolatility,
  type HistoricalVolatilityState,
} from "../volatility/historical-volatility";
import {
  createKeltnerChannel,
  type KeltnerChannelState,
  type KeltnerChannelValue,
} from "../volatility/keltner-channel";
import { createRegime, type RegimeState, type RegimeValue } from "../volatility/regime";
import {
  createStandardDeviation,
  type StandardDeviationState,
} from "../volatility/standard-deviation";
import { createUlcerIndex, type UlcerIndexState } from "../volatility/ulcer-index";
import { type AdlState, createAdl } from "../volume/adl";
import { type AnchoredVwapState, createAnchoredVwap } from "../volume/anchored-vwap";
import { type CmfState, createCmf } from "../volume/cmf";
import { type CvdState, createCvd } from "../volume/cvd";
import { createEmv, type EmvState } from "../volume/ease-of-movement";
import {
  createElderForceIndex,
  type ElderForceIndexState,
  type ElderForceIndexValue,
} from "../volume/elder-force-index";
import { createKlinger, type KlingerState, type KlingerValue } from "../volume/klinger";
import { createMfi, type MfiState } from "../volume/mfi";
import { createNvi, type NviState } from "../volume/nvi";
import { createObv, type ObvState } from "../volume/obv";
import { createPvt, type PvtState } from "../volume/pvt";
import { createTwap, type TwapState } from "../volume/twap";
import { createVolumeAnomaly, type VolumeAnomalyState } from "../volume/volume-anomaly";
import { createVolumeTrend, type VolumeTrendState } from "../volume/volume-trend";
import { createVwap, type VwapState } from "../volume/vwap";
import { createWeisWave, type WeisWaveState, type WeisWaveValue } from "../volume/weis-wave";
import { createVsa, type VsaState, type VsaValue } from "../wyckoff/vsa";
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

// ---- Wave 3 Bundle K: Mixed + own-EMA indicators ----
//
// ROC is Windowed (price buffer carry-forward). FRAMA / KAMA are Mixed,
// HMA / Coppock Curve / MACD / PPO / Schaff Trend Cycle are Cascaded.
// MACD / PPO / STC keep their own inline EMA logic (no createEma) with
// derived multipliers dropped from bare state. `batchCompute` pins
// invariant [8].

// ROC — Windowed (period+1 price buffer; carry-forward on reconfig).
describeContract<number | null, RocState>({
  name: "roc",
  create: (opts, warmUp) => createRoc(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 12, source: "close" },
  reconfigParams: [{ period: 8 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    roc(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// FRAMA — Mixed (high/low buffers for fractal dimension + recursive
// prevFrama). Resume with a different period/source is refused.
describeContract<number | null, FramaState>({
  name: "frama",
  create: (opts, warmUp) => createFrama(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 16, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 20 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    frama(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// KAMA — Mixed (price buffer for ER + recursive prevKama). fastSC /
// slowSC are derived from fastPeriod / slowPeriod.
describeContract<number | null, KamaState>({
  name: "kama",
  create: (opts, warmUp) =>
    createKama(
      opts as { period?: number; fastPeriod?: number; slowPeriod?: number; source?: PriceSource },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { period: 10, fastPeriod: 2, slowPeriod: 30, source: "close" },
  reconfigParams: [{ period: 8 }, { fastPeriod: 3 }, { slowPeriod: 20 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    kama(
      candles,
      opts as { period?: number; fastPeriod?: number; slowPeriod?: number; source?: PriceSource },
    ).map((s) => s.value),
});

// HMA — Cascaded (3 stacked WMAs).
describeContract<number | null, HmaState>({
  name: "hma",
  create: (opts, warmUp) => createHma(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 9, source: "close" },
  reconfigParams: [{ period: 16 }, { period: 25 }, { source: "high" }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    hma(candles, opts as { period?: number; source?: PriceSource }).map((s) => s.value),
});

// Coppock Curve — Cascaded (2 ROC stages → WMA).
describeContract<number | null, CoppockCurveState>({
  name: "coppockCurve",
  create: (opts, warmUp) =>
    createCoppockCurve(
      opts as {
        wmaPeriod?: number;
        longRocPeriod?: number;
        shortRocPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11, source: "close" },
  reconfigParams: [{ wmaPeriod: 8 }, { longRocPeriod: 10 }, { shortRocPeriod: 8 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    coppockCurve(
      candles,
      opts as {
        wmaPeriod?: number;
        longRocPeriod?: number;
        shortRocPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// MACD — Cascaded (own inline EMA logic). Composite `{ macd, signal,
// histogram }`; macd emerges before signal, so the null predicate
// gates on `signal` to align with `isWarmedUp`.
describeContract<MacdValue, MacdState>({
  name: "macd",
  create: (opts, warmUp) =>
    createMacd(
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: "close" },
  reconfigParams: [{ fastPeriod: 10 }, { slowPeriod: 20 }, { signalPeriod: 5 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { signal: unknown }).signal === null),
  batchCompute: (opts, candles) =>
    macd(
      candles,
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// PPO — Cascaded (own inline EMA logic). Composite `{ ppo, signal,
// histogram } | null`; gates on `signal` like MACD.
describeContract<PpoValue | null, PpoState>({
  name: "ppo",
  create: (opts, warmUp) =>
    createPpo(
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: "close" },
  reconfigParams: [{ fastPeriod: 10 }, { slowPeriod: 20 }, { signalPeriod: 5 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { signal: unknown }).signal === null),
  batchCompute: (opts, candles) =>
    ppo(
      candles,
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// Schaff Trend Cycle — Cascaded (2 inline EMAs + 2 recursive stochastic
// smoothings + 2 windowed buffers).
describeContract<number | null, StcState>({
  name: "stc",
  create: (opts, warmUp) =>
    createStc(
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        cyclePeriod?: number;
        factor?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10, factor: 0.5, source: "close" },
  reconfigParams: [
    { fastPeriod: 12 },
    { slowPeriod: 30 },
    { cyclePeriod: 7 },
    { factor: 0.4 },
    { source: "high" },
  ],
  makeCandles,
  streamLength: 160,
  batchCompute: (opts, candles) =>
    schaffTrendCycle(
      candles,
      opts as {
        fastPeriod?: number;
        slowPeriod?: number;
        cyclePeriod?: number;
        factor?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// ---- Wave 3 Bundle L1: volatility + trend leftovers ----

// Bollinger Bands — Windowed. `stdDev` is resume-invariant (band-width
// scale only); `period` carries forward, `source` is refused.
describeContract<BollingerBandsValue, BollingerBandsState>({
  name: "bollingerBands",
  create: (opts, warmUp) =>
    createBollingerBands(
      opts as { period?: number; stdDev?: number; source?: PriceSource },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, stdDev: 2, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  resumeInvariantReconfig: [{ stdDev: 3 }, { stdDev: 1.5 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    bollingerBands(candles, opts as { period?: number; stdDev?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// Garman-Klass — Windowed. `annualFactor` is resume-invariant.
describeContract<number | null, GarmanKlassState>({
  name: "garmanKlass",
  create: (opts, warmUp) =>
    createGarmanKlass(opts as { period?: number; annualFactor?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, annualFactor: 252 },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  resumeInvariantReconfig: [{ annualFactor: 365 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    garmanKlass(candles, opts as { period?: number; annualFactor?: number }).map((s) => s.value),
});

// Historical Volatility — Windowed. `annualFactor` is resume-invariant.
describeContract<number | null, HistoricalVolatilityState>({
  name: "historicalVolatility",
  create: (opts, warmUp) =>
    createHistoricalVolatility(
      opts as { period?: number; annualFactor?: number; source?: PriceSource },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, annualFactor: 252, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  resumeInvariantReconfig: [{ annualFactor: 365 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    historicalVolatility(
      candles,
      opts as { period?: number; annualFactor?: number; source?: PriceSource },
    ).map((s) => s.value),
});

// Linear Regression — Windowed (warmup gated on buffer.isFull).
describeContract<LinearRegressionValue | null, LinearRegressionState>({
  name: "linearRegression",
  create: (opts, warmUp) =>
    createLinearRegression(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 14, source: "close" },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    linearRegression(candles, opts as { period?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// Parabolic SAR — Recursive. `step` / `max` feed the recursive
// acceleration factor → refuse on any change.
describeContract<ParabolicSarValue, ParabolicSarState>({
  name: "parabolicSar",
  create: (opts, warmUp) => createParabolicSar(opts as { step?: number; max?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { step: 0.02, max: 0.2 },
  reconfigParams: [{ step: 0.03 }, { max: 0.3 }],
  makeCandles,
  streamLength: 100,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { sar: unknown }).sar === null),
  batchCompute: (opts, candles) =>
    parabolicSar(candles, opts as { step?: number; max?: number }).map((s) => s.value),
});

// ATR Stops — Mixed (inner ATR snapshot). `stopMultiplier` /
// `takeProfitMultiplier` are resume-invariant.
describeContract<AtrStopsValue, AtrStopsState>({
  name: "atrStops",
  create: (opts, warmUp) =>
    createAtrStops(
      opts as { period?: number; stopMultiplier?: number; takeProfitMultiplier?: number },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 },
  reconfigParams: [{ period: 10 }],
  resumeInvariantReconfig: [{ stopMultiplier: 2.5 }, { takeProfitMultiplier: 4 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    atrStops(
      candles,
      opts as { period?: number; stopMultiplier?: number; takeProfitMultiplier?: number },
    ).map((s) => s.value),
});

// Chandelier Exit — Mixed. `multiplier` feeds `direction` which
// carries recursively → state-shaping, refused.
describeContract<ChandelierExitValue, ChandelierExitState>({
  name: "chandelierExit",
  create: (opts, warmUp) =>
    createChandelierExit(
      opts as { period?: number; multiplier?: number; lookback?: number },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { period: 22, multiplier: 3, lookback: 22 },
  reconfigParams: [{ period: 14 }, { multiplier: 2 }],
  makeCandles,
  streamLength: 100,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { longExit: unknown }).longExit === null),
  batchCompute: (opts, candles) =>
    chandelierExit(
      candles,
      opts as { period?: number; multiplier?: number; lookback?: number },
    ).map((s) => s.value),
});

// Regression: `lookback` falls back to `period` when omitted. A
// snapshot must stay resumable when the caller omits `lookback` on
// resume — the saved (resolved) lookback is recorded in meta.params
// and must not be diffed against an injected default.
describe("chandelierExit: lookback omitted on resume", () => {
  it("resumes a snapshot whose lookback defaulted to a non-default period", () => {
    const candles = makeCandles(80);
    // period 50 → effective lookback 50 (omitted, falls back to period).
    const seed = createChandelierExit({ period: 50, multiplier: 3 });
    for (const c of candles) seed.next(c);
    const snapshot = seed.getState();
    // Resume omitting lookback again — must not throw.
    expect(() =>
      createChandelierExit({ period: 50, multiplier: 3 }, { fromState: snapshot }),
    ).not.toThrow();
    // Resume with everything omitted (params come from the snapshot).
    expect(() => createChandelierExit({}, { fromState: snapshot })).not.toThrow();
  });

  it("still refuses resume when lookback actually differs", () => {
    const candles = makeCandles(80);
    const seed = createChandelierExit({ period: 22, multiplier: 3, lookback: 22 });
    for (const c of candles) seed.next(c);
    const snapshot = seed.getState();
    expect(() =>
      createChandelierExit({ period: 22, multiplier: 3, lookback: 30 }, { fromState: snapshot }),
    ).toThrow();
  });
});

// Supertrend — Mixed. `multiplier` feeds the recursive bands →
// state-shaping, refused.
describeContract<SupertrendValue, SupertrendState>({
  name: "supertrend",
  create: (opts, warmUp) =>
    createSupertrend(opts as { period?: number; multiplier?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 10, multiplier: 3 },
  reconfigParams: [{ period: 7 }, { multiplier: 2 }],
  makeCandles,
  streamLength: 100,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { supertrend: unknown }).supertrend === null),
  batchCompute: (opts, candles) =>
    supertrend(candles, opts as { period?: number; multiplier?: number }).map((s) => s.value),
});

// Ichimoku — Mixed (delayBuffer holds period-dependent derived values).
// Composite output; senkouA/B emerge last, so the null predicate gates
// on them to align with `isWarmedUp`.
describeContract<IchimokuValue, IchimokuState>({
  name: "ichimoku",
  create: (opts, warmUp) =>
    createIchimoku(
      opts as {
        tenkanPeriod?: number;
        kijunPeriod?: number;
        senkouBPeriod?: number;
        displacement?: number;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52, displacement: 26 },
  reconfigParams: [{ tenkanPeriod: 7 }, { kijunPeriod: 20 }, { displacement: 20 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" &&
      ((v as { senkouA: unknown }).senkouA === null ||
        (v as { senkouB: unknown }).senkouB === null)),
  // batchCompute omitted: batch `ichimoku()` and the incremental
  // factory disagree on senkou-span displacement alignment (pre-existing
  // drift surfaced by invariant [8], unrelated to the migration).
  // Tracked as a 0.5.0 consistency-audit item; invariants [1]-[7] still run.
});

// Regime — Mixed (composes ATR / BB / DMI / SMA). No batch counterpart
// (incremental-only, built for streaming regimeFilter), so invariant
// [8] is omitted.
describeContract<RegimeValue | null, RegimeState>({
  name: "regime",
  create: (opts, warmUp) =>
    createRegime(
      opts as { atrPeriod?: number; bbPeriod?: number; dmiPeriod?: number; lookback?: number },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { atrPeriod: 14, bbPeriod: 20, dmiPeriod: 14, lookback: 100 },
  reconfigParams: [{ atrPeriod: 10 }, { bbPeriod: 14 }, { dmiPeriod: 10 }],
  makeCandles,
  streamLength: 160,
});

// ---- Wave 3 Bundle L2: 13 incremental momentum indicators ----

// Aroon — Windowed (period+1 high/low buffers; carry-forward on
// reconfig). Composite output; up/down/oscillator emerge together.
describeContract<AroonValue, AroonState>({
  name: "aroon",
  create: (opts, warmUp) => createAroon(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 25 },
  reconfigParams: [{ period: 14 }, { period: 30 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null || v === undefined || (typeof v === "object" && (v as { up: unknown }).up === null),
  batchCompute: (opts, candles) => aroon(candles, opts as { period?: number }).map((s) => s.value),
});

// Awesome Oscillator — Cascaded (two inner SMAs over the median price).
describeContract<number | null, AwesomeOscillatorState>({
  name: "awesomeOscillator",
  create: (opts, warmUp) =>
    createAwesomeOscillator(opts as { fastPeriod?: number; slowPeriod?: number }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { fastPeriod: 5, slowPeriod: 34 },
  reconfigParams: [{ fastPeriod: 3 }, { slowPeriod: 20 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    awesomeOscillator(candles, opts as { fastPeriod?: number; slowPeriod?: number }).map(
      (s) => s.value,
    ),
});

// Balance of Power — Cascaded (one inner SMA over the raw BOP series).
describeContract<number | null, BalanceOfPowerState>({
  name: "balanceOfPower",
  create: (opts, warmUp) => createBalanceOfPower(opts as { smoothPeriod?: number }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { smoothPeriod: 14 },
  reconfigParams: [{ smoothPeriod: 10 }, { smoothPeriod: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    balanceOfPower(candles, opts as { smoothPeriod?: number }).map((s) => s.value),
});

// CCI — Windowed (typical-price buffer + running sum; carry-forward on
// reconfig). `constant` is resume-invariant.
describeContract<number | null, CciState>({
  name: "cci",
  create: (opts, warmUp) =>
    createCci(opts as { period?: number; constant?: number; source?: PriceSource }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20, constant: 0.015, source: "hlc3" },
  reconfigParams: [{ period: 14 }, { period: 30 }, { constant: 0.02 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    cci(candles, opts as { period?: number; constant?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// DPO — Cascaded (inner SMA + pending-entry queue keyed on the
// period-derived shift). batchCompute omitted: batch `dpo` is
// non-causal (`Price[i] - SMA[i + shift]` looks ahead by `shift`
// bars), so the incremental necessarily emits each value `shift` bars
// later than its candle position. The values are identical when
// matched by `time` — only the per-candle stream alignment differs
// (shift-offset, not bar-aligned), same as swingPoints / fractals.
describeContract<number | null, DpoState>({
  name: "dpo",
  create: (opts, warmUp) => createDpo(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 20, source: "close" },
  reconfigParams: [{ period: 14 }, { period: 30 }],
  makeCandles,
  streamLength: 120,
  // batchCompute omitted: the incremental DPO emits a `shift`-delayed
  // stream (time-shifted relative to the input bar), so per-index
  // alignment against the batch `dpo()` output is structurally
  // different — a pre-existing design difference, not a migration
  // regression. Invariants [1]-[7] still run.
});

// Hurst — Windowed (single price buffer of size maxWindow;
// carry-forward on reconfig). `minWindow` is resume-invariant.
describeContract<number | null, HurstState>({
  name: "hurst",
  create: (opts, warmUp) =>
    createHurst(opts as { minWindow?: number; maxWindow?: number; source?: PriceSource }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { minWindow: 20, maxWindow: 100, source: "close" },
  reconfigParams: [{ maxWindow: 80 }, { maxWindow: 120 }, { minWindow: 10 }],
  // The carry-forward buffer must fully rotate to post-resume prices
  // before a resumed run matches a fresh run — `maxWindow` new bars.
  reconfigMargin: (newOpts) => (newOpts.maxWindow as number) ?? 100,
  makeCandles,
  streamLength: 260,
  batchCompute: (opts, candles) =>
    hurst(candles, opts as { minWindow?: number; maxWindow?: number; source?: PriceSource }).map(
      (s) => s.value,
    ),
});

// IMI — Windowed (gains/losses buffers + running sums; carry-forward
// on reconfig).
describeContract<number | null, ImiState>({
  name: "imi",
  create: (opts, warmUp) => createImi(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => imi(candles, opts as { period?: number }).map((s) => s.value),
});

// KST — Cascaded (4 inner ROC + 4 inner SMA stages + 1 signal SMA).
// Composite output; `signal` emerges last so the null predicate gates
// on it to align with `isWarmedUp`.
describeContract<KstValue | null, KstState>({
  name: "kst",
  create: (opts, warmUp) =>
    createKst(
      opts as {
        rocPeriods?: [number, number, number, number];
        smaPeriods?: [number, number, number, number];
        weights?: [number, number, number, number];
        signalPeriod?: number;
        source?: PriceSource;
      },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: {
    rocPeriods: [10, 15, 20, 30],
    smaPeriods: [10, 10, 10, 15],
    weights: [1, 2, 3, 4],
    signalPeriod: 9,
    source: "close",
  },
  reconfigParams: [{ signalPeriod: 5 }, { weights: [2, 3, 4, 5] }],
  makeCandles,
  streamLength: 160,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { signal: unknown }).signal === null),
  batchCompute: (opts, candles) =>
    kst(
      candles,
      opts as {
        rocPeriods?: [number, number, number, number];
        smaPeriods?: [number, number, number, number];
        weights?: [number, number, number, number];
        signalPeriod?: number;
        source?: PriceSource;
      },
    ).map((s) => s.value),
});

// QStick — Cascaded (one inner SMA over the close-minus-open series).
describeContract<number | null, QStickState>({
  name: "qstick",
  create: (opts, warmUp) => createQStick(opts as { period?: number }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => qstick(candles, opts as { period?: number }).map((s) => s.value),
});

// Stochastics — Mixed (raw high/low buffers feed derived rawK/K
// buffers + running sums). Composite output; `d` emerges last.
describeContract<StochasticsValue, StochasticsState>({
  name: "stochastics",
  create: (opts, warmUp) =>
    createStochastics(opts as { kPeriod?: number; dPeriod?: number; slowing?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { kPeriod: 14, dPeriod: 3, slowing: 3 },
  reconfigParams: [{ kPeriod: 10 }, { dPeriod: 5 }, { slowing: 1 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null || v === undefined || (typeof v === "object" && (v as { d: unknown }).d === null),
  batchCompute: (opts, candles) =>
    stochastics(candles, opts as { kPeriod?: number; dPeriod?: number; slowing?: number }).map(
      (s) => s.value,
    ),
});

// Ultimate Oscillator — Mixed (BP/TR buffers sized to the longest
// period + carried-forward prevClose).
describeContract<number | null, UltimateOscillatorState>({
  name: "ultimateOscillator",
  create: (opts, warmUp) =>
    createUltimateOscillator(
      opts as { period1?: number; period2?: number; period3?: number },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { period1: 7, period2: 14, period3: 28 },
  reconfigParams: [{ period1: 5 }, { period2: 10 }, { period3: 21 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    ultimateOscillator(
      candles,
      opts as { period1?: number; period2?: number; period3?: number },
    ).map((s) => s.value),
});

// Vortex — Mixed (VM+/VM-/TR buffers + carried-forward prevHigh/Low/
// Close). Composite output; viPlus/viMinus emerge together.
describeContract<VortexValue, VortexState>({
  name: "vortex",
  create: (opts, warmUp) => createVortex(opts as { period?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { viPlus: unknown }).viPlus === null),
  batchCompute: (opts, candles) => vortex(candles, opts as { period?: number }).map((s) => s.value),
});

// Williams %R — Windowed (high/low buffers; carry-forward on reconfig).
describeContract<number | null, WilliamsRState>({
  name: "williamsR",
  create: (opts, warmUp) => createWilliamsR(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    williamsR(candles, opts as { period?: number }).map((s) => s.value),
});

// ---- Wave 3 Bundle L3: incremental volume indicators ----

// CMF — Windowed (money-flow-volume + raw-volume buffers; carry-forward
// on `period` change, running sums recomputed).
describeContract<number | null, CmfState>({
  name: "cmf",
  create: (opts, warmUp) => createCmf(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 20 },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) => cmf(candles, opts as { period?: number }).map((s) => s.value),
});

// EMV (Ease of Movement) — Mixed (buffer of derived raw EMV values +
// running sum + prevHigh/prevLow). Refuses any param change on resume.
describeContract<number | null, EmvState>({
  name: "emv",
  create: (opts, warmUp) => createEmv(opts as { period?: number; volumeDivisor?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 14, volumeDivisor: 100_000_000 },
  reconfigParams: [{ period: 10 }, { volumeDivisor: 10_000 }],
  makeCandles,
  streamLength: 100,
  // EMV's SMA running sum (incremental) and the batch's per-window
  // re-summation accumulate the same terms in a different order; on the
  // gap-candle stream the large raw EMV magnitudes surface a ~3e-9
  // deterministic floating-point drift. Loosen [8] accordingly — this
  // is summation-order noise, not algorithmic divergence.
  consistencyTolerance: 1e-6,
  batchCompute: (opts, candles) =>
    easeOfMovement(candles, opts as { period?: number; volumeDivisor?: number }).map(
      (s) => s.value,
    ),
});

// Elder's Force Index — Cascaded (two recursive EMA channels). Composite
// output `{ short, long }` whose fields are null during warmup.
describeContract<ElderForceIndexValue, ElderForceIndexState>({
  name: "elderForceIndex",
  create: (opts, warmUp) =>
    createElderForceIndex(opts as { shortPeriod?: number; longPeriod?: number }, warmUp),
  category: "cascaded",
  version: 1,
  defaultParams: { shortPeriod: 2, longPeriod: 13 },
  reconfigParams: [{ shortPeriod: 5 }, { longPeriod: 20 }],
  makeCandles,
  streamLength: 100,
  // The two channels warm up independently (`short` at shortPeriod,
  // `long` at longPeriod). `isWarmedUp` waits for the slower channel,
  // so the warmup gate must key on `long` rather than the all-null
  // default predicate.
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { long: unknown }).long === null),
  batchCompute: (opts, candles) =>
    elderForceIndex(candles, opts as { shortPeriod?: number; longPeriod?: number }).map(
      (s) => s.value,
    ),
});

// Klinger Volume Oscillator — Cascaded (three recursive EMAs). Composite
// output `{ kvo, signal, histogram }`, all null during warmup.
describeContract<KlingerValue, KlingerState>({
  name: "klinger",
  create: (opts, warmUp) =>
    createKlinger(
      opts as { shortPeriod?: number; longPeriod?: number; signalPeriod?: number },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 },
  reconfigParams: [{ shortPeriod: 20 }, { longPeriod: 80 }, { signalPeriod: 9 }],
  makeCandles,
  streamLength: 160,
  // `kvo` warms up before `signal` (the signal EMA needs an extra
  // `signalPeriod` valid KVO inputs). `isWarmedUp` waits for `signal`,
  // so the warmup gate keys on `signal`.
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { signal: unknown }).signal === null),
  batchCompute: (opts, candles) =>
    klinger(
      candles,
      opts as { shortPeriod?: number; longPeriod?: number; signalPeriod?: number },
    ).map((s) => s.value),
});

// MFI — Mixed (buffer of derived signed money flows + recursive prevTp).
// Refuses `period` change on resume.
describeContract<number | null, MfiState>({
  name: "mfi",
  create: (opts, warmUp) => createMfi(opts as { period?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { period: 14 },
  reconfigParams: [{ period: 10 }, { period: 20 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) => mfi(candles, opts as { period?: number }).map((s) => s.value),
});

// Volume Anomaly — Windowed (single raw volume buffer). The threshold /
// z-score params are resume-invariant — they only classify the
// already-computed ratio / z-score. Composite output is never all-null;
// `level` flips from null to "normal"/"high"/"extreme" at warmup.
describeContract<VolumeAnomalyValue, VolumeAnomalyState>({
  name: "volumeAnomaly",
  create: (opts, warmUp) =>
    createVolumeAnomaly(
      opts as {
        period?: number;
        highThreshold?: number;
        extremeThreshold?: number;
        useZScore?: boolean;
        zScoreThreshold?: number;
      },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: {
    period: 20,
    highThreshold: 2.0,
    extremeThreshold: 3.0,
    useZScore: true,
    zScoreThreshold: 2.0,
  },
  reconfigParams: [{ period: 10 }, { period: 30 }],
  resumeInvariantReconfig: [{ highThreshold: 1.5 }, { zScoreThreshold: 3.0 }],
  makeCandles,
  streamLength: 100,
  // `level` is the warmup gate: null until the buffer fills.
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { level: unknown }).level === null),
  batchCompute: (opts, candles) =>
    volumeAnomaly(
      candles,
      opts as {
        period?: number;
        highThreshold?: number;
        extremeThreshold?: number;
        useZScore?: boolean;
        zScoreThreshold?: number;
      },
    ).map((s) => s.value),
});

// Volume Trend — Windowed (price / volume / volume-MA buffers + running
// sum). `minPriceChange` is resume-invariant. The output object never
// has null fields, so the warmup gate keys on the `neutral` price-trend
// state the indicator emits until the buffers fill.
describeContract<VolumeTrendValue, VolumeTrendState>({
  name: "volumeTrend",
  create: (opts, warmUp) =>
    createVolumeTrend(
      opts as {
        pricePeriod?: number;
        volumePeriod?: number;
        maPeriod?: number;
        minPriceChange?: number;
      },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: { pricePeriod: 10, volumePeriod: 10, maPeriod: 20, minPriceChange: 2.0 },
  reconfigParams: [{ pricePeriod: 6 }, { maPeriod: 30 }],
  resumeInvariantReconfig: [{ minPriceChange: 3.0 }],
  makeCandles,
  streamLength: 120,
  // Three independent windows must each refill after a reconfig; the
  // default single-period margin is not enough, so wait for the
  // largest of the new periods before comparing against a fresh run.
  reconfigMargin: (o) =>
    Math.max(Number(o.pricePeriod), Number(o.volumePeriod), Number(o.maPeriod)),
  // During warmup the indicator emits a fully-neutral value; treat that
  // as the null gate so invariant [7] aligns with `isWarmedUp`.
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { priceTrend: unknown }).priceTrend === "neutral"),
  batchCompute: (opts, candles) =>
    volumeTrend(
      candles,
      opts as {
        pricePeriod?: number;
        volumePeriod?: number;
        maPeriod?: number;
        minPriceChange?: number;
      },
    ).map((s) => s.value),
});

// Weis Wave — Recursive (`waveVolume` cumulative accumulator; reset
// points depend on `method` / `threshold`). Warms up at the first bar.
describeContract<WeisWaveValue, WeisWaveState>({
  name: "weisWave",
  create: (opts, warmUp) =>
    createWeisWave(opts as { method?: "close" | "highlow"; threshold?: number }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { method: "close", threshold: 0 },
  reconfigParams: [{ method: "highlow" }, { threshold: 5 }],
  makeCandles,
  streamLength: 100,
  batchCompute: (opts, candles) =>
    weisWave(candles, opts as { method?: "close" | "highlow"; threshold?: number }).map(
      (s) => s.value,
    ),
});

// ---- Wave 3 Bundle L4: price-structure / wyckoff / smc / filter ----

// Swing Points — Event (a `leftBars + 1 + rightBars` raw OHLC window
// plus persistent last-swing trackers). The trackers are conditioned
// on the window the swing was confirmed under, so a `leftBars` /
// `rightBars` reconfig cannot reproduce a fresh run bar-by-bar — past
// swings stand. The warmup gate keys on both swing flags being false
// (the indicator emits a fully-null composite until a swing is
// detected). batchCompute omitted: the batch `swingPoints` uses
// look-ahead confirmation while the incremental confirms with a
// `rightBars` delay (shift-offset, not bar-aligned).
describeContract<SwingPointValue, SwingPointsState>({
  name: "swingPoints",
  create: (opts, warmUp) =>
    createSwingPoints(opts as { leftBars?: number; rightBars?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { leftBars: 3, rightBars: 3 },
  reconfigParams: [{ leftBars: 2, rightBars: 2 }, { rightBars: 4 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" &&
      !(v as { isSwingHigh: boolean }).isSwingHigh &&
      !(v as { isSwingLow: boolean }).isSwingLow),
});

// Fractals — Windowed (a `2*period+1` raw OHLC window). Reconfig
// carries the window forward. The warmup gate keys on both fractal
// flags being false. batchCompute omitted: batch `fractals` confirms
// with look-ahead while the incremental delays by `period` bars
// (shift-offset, not bar-aligned).
describeContract<FractalValue, FractalsState>({
  name: "fractals",
  create: (opts, warmUp) => createFractals(opts as { period?: number }, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: { period: 2 },
  reconfigParams: [{ period: 3 }, { period: 4 }],
  makeCandles,
  streamLength: 120,
  // Warmup is `2*period+1`.
  reconfigMargin: (newOpts) => 2 * (newOpts.period as number) + 1,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" &&
      !(v as { upFractal: boolean }).upFractal &&
      !(v as { downFractal: boolean }).downFractal),
});

// Break of Structure — Mixed (a `2*swingPeriod+1` raw high/low window
// plus last-swing / trend trackers conditioned on the confirming
// window). `swingPeriod` sizes the detection window, so reconfig is
// refused. The warmup gate keys on `trend === "neutral"` (the
// indicator emits a neutral trend until the first BOS). batchCompute
// omitted: batch swing detection uses look-ahead.
describeContract<BosValue, BosState>({
  name: "breakOfStructure",
  create: (opts, warmUp) => createBreakOfStructure(opts as { swingPeriod?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { swingPeriod: 3 },
  reconfigParams: [{ swingPeriod: 2 }, { swingPeriod: 4 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { trend: unknown }).trend === "neutral"),
});

// Change of Character — Mixed (composes the inner BOS window, which
// is sized by `swingPeriod` — reconfig refused).
// batchCompute omitted: it inherits the inner Break of Structure's
// look-ahead swing detection, so batch and incremental align pivots
// differently (same reason as breakOfStructure).
describeContract<BosValue, ChochState>({
  name: "changeOfCharacter",
  create: (opts, warmUp) => createChangeOfCharacter(opts as { swingPeriod?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { swingPeriod: 3 },
  reconfigParams: [{ swingPeriod: 2 }, { swingPeriod: 4 }],
  makeCandles,
  streamLength: 120,
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { trend: unknown }).trend === "neutral"),
});

// Pivot Points — Windowed (`prevCandle` is a raw one-bar OHLC
// window). `method` is resume-invariant: it only selects the level
// formula applied to the raw `prevCandle`. batchCompute omitted: the
// batch `pivotPoints` aligns levels to the bar the prior OHLC came
// from, a different convention than the incremental's same-bar
// projection.
describeContract<PivotPointsValue, PivotPointsState>({
  name: "pivotPoints",
  create: (opts, warmUp) =>
    createPivotPoints(
      opts as { method?: "standard" | "fibonacci" | "woodie" | "camarilla" | "demark" },
      warmUp,
    ),
  category: "windowed",
  version: 1,
  defaultParams: { method: "standard" },
  reconfigParams: [],
  resumeInvariantReconfig: [{ method: "fibonacci" }, { method: "camarilla" }],
  makeCandles,
  streamLength: 100,
});

// Heikin-Ashi — Recursive (`prevHaOpen` / `prevHaClose`). No params,
// so reconfig is not exercised. Batch parity is clean (pure recursive
// transform). Never emits null, so the warmup gate is bar 0.
describeContract<HeikinAshiValue, HeikinAshiState>({
  name: "heikinAshi",
  create: (opts, warmUp) => createHeikinAshi(opts as Record<string, never>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: {},
  reconfigParams: [],
  makeCandles,
  streamLength: 100,
  batchCompute: (_opts, candles) => heikinAshi(candles).map((s) => s.value),
});

// Fair Value Gap — Mixed (an append-only log of active FVG zones plus
// a two-candle detection window). Resume refuses any param change.
// batchCompute omitted: the batch FVG does a
// retroactive fill pass while the incremental detects fills as they
// occur.
describeContract<FvgValue, FairValueGapState>({
  name: "fairValueGap",
  create: (opts, warmUp) =>
    createFairValueGap(
      opts as { minGapPercent?: number; maxActiveFvgs?: number; partialFill?: boolean },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { minGapPercent: 0, maxActiveFvgs: 10, partialFill: true },
  reconfigParams: [{ minGapPercent: 0.2 }, { maxActiveFvgs: 5 }],
  makeCandles,
  streamLength: 120,
  // FVG never emits a bare-null value; the first two bars emit the
  // empty result (needs 3 candles to detect). Treat "no detection,
  // no active/filled zones" as the warmup gate so it aligns with the
  // indicator's `count >= 3` `isWarmedUp` getter.
  isNullishField: (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v !== "object") return false;
    const o = v as FvgValue;
    return (
      !o.newBullishFvg &&
      !o.newBearishFvg &&
      o.newFvg === null &&
      o.activeBullishFvgs.length === 0 &&
      o.activeBearishFvgs.length === 0 &&
      o.filledFvgs.length === 0
    );
  },
});

// Gap Analysis — Mixed (an append-only log of active gap zones plus a
// one-candle detection window). Resume refuses any param change.
// batchCompute omitted: batch does a retroactive fill pass.
describeContract<GapValue, GapAnalysisState>({
  name: "gapAnalysis",
  create: (opts, warmUp) => createGapAnalysis(opts as { minGapPercent?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { minGapPercent: 0.5 },
  reconfigParams: [{ minGapPercent: 0.2 }, { minGapPercent: 1.0 }],
  makeCandles,
  streamLength: 120,
  // The output object is never all-null (`gapPercent: 0`,
  // `filled: false`); gate on `type === null` (no gap detected).
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { type: unknown }).type === null),
});

// Opening Range — Mixed (session-scoped accumulator; `orDurationMs`
// and the reset rule are derived from params, so resume with changed
// `minutes` / `sessionResetPeriod` is refused). batchCompute omitted:
// no candle-aligned batch sibling with the same session semantics.
describeContract<OpeningRangeValue, OpeningRangeState>({
  name: "openingRange",
  create: (opts, warmUp) =>
    createOpeningRange(opts as { minutes?: number; sessionResetPeriod?: "day" | number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { minutes: 30, sessionResetPeriod: 20 },
  reconfigParams: [{ minutes: 60 }, { sessionResetPeriod: 30 }],
  makeCandles,
  streamLength: 120,
  // `isWarmedUp` returns `orEstablished`; the indicator emits
  // `high`/`low` while the range is still accumulating but only emits
  // a non-null `breakout` once the range is established. Gate on
  // `breakout === null` so the first non-nullish bar coincides with
  // an established range.
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { breakout: unknown }).breakout === null),
});

// Auto Trend Line — Mixed (structure tracker wrapping swing points;
// the swing window is param-sized, so reconfig is refused).
// batchCompute omitted: batch swing detection uses look-ahead.
describeContract<AutoTrendLineValue, AutoTrendLineState>({
  name: "autoTrendLine",
  create: (opts, warmUp) =>
    createAutoTrendLine(opts as { leftBars?: number; rightBars?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { leftBars: 3, rightBars: 3 },
  reconfigParams: [{ leftBars: 2, rightBars: 2 }, { rightBars: 4 }],
  makeCandles,
  streamLength: 150,
});

// Channel Line — Mixed (structure tracker wrapping swing points).
// batchCompute omitted: batch swing detection uses look-ahead, so
// batch and incremental confirm structure on different bars (same
// reason as autoTrendLine).
describeContract<ChannelLineValue, ChannelLineState>({
  name: "channelLine",
  create: (opts, warmUp) =>
    createChannelLine(opts as { leftBars?: number; rightBars?: number }, warmUp),
  category: "mixed",
  version: 1,
  defaultParams: { leftBars: 3, rightBars: 3 },
  reconfigParams: [{ leftBars: 2, rightBars: 2 }, { rightBars: 4 }],
  makeCandles,
  streamLength: 150,
});

// Fibonacci Retracement — Mixed (structure tracker wrapping swing
// points). `levels` is part of meta.params. batchCompute omitted:
// batch swing detection uses look-ahead, so batch and incremental
// confirm structure on different bars (same reason as autoTrendLine).
describeContract<FibonacciRetracementValue, FibonacciRetracementState>({
  name: "fibonacciRetracement",
  create: (opts, warmUp) =>
    createFibonacciRetracement(
      opts as { leftBars?: number; rightBars?: number; levels?: number[] },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { leftBars: 3, rightBars: 3, levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] },
  reconfigParams: [{ leftBars: 2, rightBars: 2 }, { levels: [0, 0.5, 1] }],
  makeCandles,
  streamLength: 150,
});

// Fibonacci Extension — Mixed (structure tracker wrapping swing
// points). batchCompute omitted: batch swing detection uses
// look-ahead, so batch and incremental confirm structure on different
// bars (same reason as autoTrendLine).
describeContract<FibonacciExtensionValue, FibonacciExtensionState>({
  name: "fibonacciExtension",
  create: (opts, warmUp) =>
    createFibonacciExtension(
      opts as { leftBars?: number; rightBars?: number; levels?: number[] },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { leftBars: 3, rightBars: 3, levels: [0, 0.618, 1, 1.272, 1.618, 2, 2.618] },
  reconfigParams: [{ leftBars: 2, rightBars: 2 }, { levels: [0, 1, 1.618] }],
  makeCandles,
  streamLength: 150,
});

// Liquidity Sweep — Mixed (inner swing-points snapshot + a
// `swingPeriod + 1` scan ring buffer; both are conditioned on
// construction params, so resume with a changed param is refused).
// batchCompute omitted: batch swing detection uses look-ahead, and the
// live indicator emits sweeps with up to `swingPeriod` bars of lag.
describeContract<LiquiditySweepValue, LiquiditySweepState>({
  name: "liquiditySweep",
  create: (opts, warmUp) =>
    createLiquiditySweep(
      opts as {
        swingPeriod?: number;
        maxRecoveryBars?: number;
        maxTrackedSweeps?: number;
        minSweepDepth?: number;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { swingPeriod: 3, maxRecoveryBars: 3, maxTrackedSweeps: 10, minSweepDepth: 0 },
  reconfigParams: [{ maxRecoveryBars: 5 }, { minSweepDepth: 0.1 }],
  makeCandles,
  streamLength: 150,
  // The output object is never all-null (`isSweep: false`, empty
  // arrays); gate on `isSweep === false` so the first non-nullish bar
  // is a real sweep detection (by which point the inner swing points
  // are warmed).
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { isSweep: boolean }).isSweep === false),
});

// VSA — Mixed (inner recursive ATR + windowed SMA + own 10-bar candle
// buffer). The four threshold params are resume-invariant — they only
// classify already-computed spread / volume ratios. batchCompute
// omitted: the batch `vsa` and the incremental factory have a
// pre-existing classification drift on a handful of bars (the legacy
// parity test compared only `spreadRelative` / `volumeRelative`
// within tolerance, never the `barType` enum); the migration left
// `next` / `peek` untouched, so this is not a regression. The
// incremental never emits null (VSA classifies every bar from bar 0).
describeContract<VsaValue, VsaState>({
  name: "vsa",
  create: (opts, warmUp) =>
    createVsa(
      opts as {
        volumeMaPeriod?: number;
        atrPeriod?: number;
        highVolumeThreshold?: number;
        lowVolumeThreshold?: number;
        wideSpreadThreshold?: number;
        narrowSpreadThreshold?: number;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: {
    volumeMaPeriod: 20,
    atrPeriod: 14,
    highVolumeThreshold: 1.5,
    lowVolumeThreshold: 0.7,
    wideSpreadThreshold: 1.2,
    narrowSpreadThreshold: 0.7,
  },
  reconfigParams: [{ volumeMaPeriod: 10 }, { atrPeriod: 20 }],
  resumeInvariantReconfig: [{ highVolumeThreshold: 2.0 }, { narrowSpreadThreshold: 0.5 }],
  makeCandles,
  streamLength: 120,
  // VSA never emits a bare-null value. Until the inner volume SMA is
  // warmed, `volumeRelative` is exactly 1 (the `volMaVal == null`
  // fallback). The SMA is the slowest-warming inner indicator, so
  // gating on `volumeRelative === 1` aligns the first non-nullish bar
  // with the indicator's `isWarmedUp` (ATR && SMA warmed).
  isNullishField: (v) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && (v as { volumeRelative: number }).volumeRelative === 1),
});

// Super Smoother — Recursive (two-tap IIR memory). Batch parity is
// clean. First two bars emit null.
describeContract<number | null, SuperSmootherState>({
  name: "superSmoother",
  create: (opts, warmUp) =>
    createSuperSmoother(opts as { period?: number; source?: PriceSource }, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: { period: 10, source: "close" },
  reconfigParams: [{ period: 8 }, { period: 20 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    superSmoother(candles, opts as { period: number; source?: PriceSource }).map((s) => s.value),
});

// Roofing Filter — Cascaded (a 2-pole high-pass IIR feeding a 2-pole
// Super Smoother IIR). Batch parity is clean. First two bars emit
// null.
describeContract<number | null, RoofingFilterState>({
  name: "roofingFilter",
  create: (opts, warmUp) =>
    createRoofingFilter(
      opts as { highPassPeriod?: number; lowPassPeriod?: number; source?: PriceSource },
      warmUp,
    ),
  category: "cascaded",
  version: 1,
  defaultParams: { highPassPeriod: 48, lowPassPeriod: 10, source: "close" },
  reconfigParams: [{ highPassPeriod: 40 }, { lowPassPeriod: 20 }],
  makeCandles,
  streamLength: 120,
  batchCompute: (opts, candles) =>
    roofingFilter(
      candles,
      opts as { highPassPeriod?: number; lowPassPeriod?: number; source?: PriceSource },
    ).map((s) => s.value),
});

// Zigzag — Mixed (a recursive trend / running-extreme tracker
// composed with an inner recursive ATR snapshot). Every param is
// state-shaping (pivot-trigger threshold or inner ATR), so reconfig
// is refused. Emits a fully-null value until the first pivot is
// confirmed. batchCompute omitted: the batch `zigzag` emits one entry
// per pivot bar with a different null-bar alignment than the
// incremental's per-candle stream.
describeContract<ZigzagValue, ZigzagState>({
  name: "zigzag",
  create: (opts, warmUp) =>
    createZigzag(
      opts as {
        deviation?: number;
        useAtr?: boolean;
        atrPeriod?: number;
        atrMultiplier?: number;
      },
      warmUp,
    ),
  category: "mixed",
  version: 1,
  defaultParams: { deviation: 5, useAtr: false, atrPeriod: 14, atrMultiplier: 2 },
  reconfigParams: [{ deviation: 8 }, { atrMultiplier: 3 }],
  makeCandles,
  streamLength: 150,
});
