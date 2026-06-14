/**
 * Event study — does a pattern detector's firing carry predictive power?
 *
 * Given the bars at which a detector fired (order blocks, fair-value gaps,
 * liquidity sweeps, BOS/CHoCH, VSA signals, divergences, …) plus the candles,
 * this measures the distribution of forward returns after each event and tests
 * it for significance against the unconditional baseline — the conditional vs
 * unconditional comparison of Lo, Mamaysky & Wang (2000), "Foundations of
 * Technical Analysis" (J. Finance), within the abnormal-return / AAR framework
 * of MacKinlay (1997) and Brown & Warner (1985).
 *
 * For each horizon the report gives the mean and abnormal mean (AAR) forward
 * return, an asymptotic t-test, a non-parametric **pseudo-event bootstrap**
 * p-value (the workhorse, since financial returns are non-normal), a hit rate
 * with a binomial test, and distribution shape (median, skew, excess kurtosis,
 * percentiles). Bootstrap p-values are also Benjamini-Hochberg adjusted across
 * the horizons.
 *
 * **Caveats** (read before trusting a result):
 * - *Look-ahead*: the events must be detectable in real time. A detector that
 *   confirms a pattern only with later bars (two-sided smoothing, lagged
 *   confirmation) embeds future information and inflates the result. Lag the
 *   events past their confirmation bar.
 * - *Overlapping windows*: events spaced closer than a horizon share future
 *   bars, so their returns are not independent — this understates the standard
 *   error and inflates significance. `overlappingEvents` reports how many do;
 *   use `minSeparation` to thin them, and prefer the bootstrap p-value.
 * - *Small samples*: read `n` before trusting any ratio; few events give
 *   unreliable t-stats and especially unreliable skew/kurtosis.
 * - *Multiple testing*: the per-horizon p-values are not independent; use the
 *   Benjamini-Hochberg-adjusted bootstrap p-value when scanning horizons.
 */

import { mulberry32 } from "../core/random";
import { kurtosis, normalCdf, skewness } from "../core/statistics";
import type { NormalizedCandle, Series } from "../types";
import { sampleStd } from "./return-metrics";

/** Abnormal-return baseline. */
export type EventStudyBaseline = "mean-adjusted" | "raw";

/** Options for {@link eventStudy}. */
export type EventStudyOptions = {
  /** Forward horizons in bars (default `[1, 5, 10, 20]`). */
  horizons?: number[];
  /**
   * Abnormal-return baseline (default `"mean-adjusted"`): subtract the
   * unconditional mean forward return at each horizon (the single-instrument
   * canonical baseline). `"raw"` tests the forward return against zero.
   */
  baseline?: EventStudyBaseline;
  /** Pseudo-event bootstrap resamples (default 1000; 0 disables the bootstrap). */
  bootstrap?: number;
  /** Seed for the bootstrap RNG (default 42); results are deterministic. */
  seed?: number;
  /**
   * Drop an event whose bar is within this many bars of the previous kept
   * event, to thin overlapping windows (default 0 — keep every event).
   */
  minSeparation?: number;
};

/** Per-horizon forward-return statistics for an event study. */
export type EventHorizonStats = {
  /** Forward horizon in bars. */
  horizon: number;
  /** Events with a full forward window at this horizon. */
  n: number;
  /** Mean event forward return (fraction). */
  meanReturn: number;
  /** Median event forward return (fraction). */
  medianReturn: number;
  /** Unconditional mean forward return over the whole series (the baseline). */
  unconditionalMeanReturn: number;
  /** Mean abnormal return = `meanReturn − unconditionalMeanReturn` (the AAR). */
  meanAbnormalReturn: number;
  /** Sample standard deviation (ddof = 1) of the event forward returns. */
  stdReturn: number;
  /** Cross-sectional t-statistic of the abnormal return: `√n · AAR / std`. */
  tStat: number;
  /** Two-sided asymptotic (normal-approximation) p-value of `tStat`. */
  pValue: number;
  /**
   * Two-sided pseudo-event bootstrap p-value of the abnormal return — how often
   * random event timing deviates from the baseline reference by at least as
   * much as the events do (`NaN` when disabled or `n = 0`).
   */
  bootstrapPValue: number;
  /** Benjamini-Hochberg-adjusted `bootstrapPValue` across the studied horizons. */
  bootstrapPValueAdjusted: number;
  /** Fraction of events with a strictly positive forward return. */
  hitRate: number;
  /** Two-sided binomial p-value of the hit rate against 0.5 (normal approx). */
  hitRatePValue: number;
  /** Skewness of the event forward returns. */
  skewness: number;
  /** Excess kurtosis of the event forward returns. */
  kurtosis: number;
  /** Percentiles of the event forward returns. */
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
};

/** Result of an {@link eventStudy}. */
export type EventStudyResult = {
  /** Distinct in-range event bars studied (after de-duplication / `minSeparation`). */
  eventCount: number;
  /** The abnormal-return baseline used. */
  baseline: EventStudyBaseline;
  /** Per-horizon statistics, in the order of the requested horizons. */
  horizons: EventHorizonStats[];
  /**
   * Events that share a forward window with the previous event at the longest
   * horizon — a non-independence flag (their overlapping returns inflate
   * significance). `0` when every event is spaced beyond the max horizon.
   */
  overlappingEvents: number;
};

/** Forward return from bar `i` to bar `i + h` (simple fraction). */
function forwardReturn(candles: NormalizedCandle[], i: number, h: number): number {
  const base = candles[i].close;
  return base !== 0 ? (candles[i + h].close - base) / base : 0;
}

/** Linear-interpolated percentile (`0..100`) from an ascending-sorted array. */
function percentileSorted(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sortedAsc[0];
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sortedAsc[lo] : sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/** Two-sided p-value of a t/z statistic under the normal approximation. */
function twoSidedP(stat: number): number {
  if (!Number.isFinite(stat)) return Number.NaN;
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(stat))));
}

/** Two-sided binomial p-value of `wins`/`n` against 0.5 (normal approx, continuity-corrected). */
function binomialTwoSidedP(wins: number, n: number): number {
  if (n === 0) return Number.NaN;
  const z = (Math.abs(wins - n / 2) - 0.5) / (0.5 * Math.sqrt(n));
  return z <= 0 ? 1 : Math.min(1, 2 * (1 - normalCdf(z)));
}

/** Benjamini-Hochberg-adjusted p-values; `NaN` inputs pass through as `NaN`. */
function benjaminiHochberg(pValues: number[]): number[] {
  const finite = pValues
    .map((p, i) => ({ p, i }))
    .filter((x) => Number.isFinite(x.p))
    .sort((a, b) => a.p - b.p);
  const adjusted = pValues.map(() => Number.NaN);
  const m = finite.length;
  let running = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = finite[rank - 1];
    running = Math.min(running, Math.min(1, (p * m) / rank));
    adjusted[i] = running;
  }
  return adjusted;
}

/** Normalize the event input to a sorted, unique array of in-range bar indices. */
function toEventIndices(
  events: number[] | Series<boolean>,
  timeToIndex: Map<number, number>,
): number[] {
  if (events.length === 0) return [];
  const first: unknown = events[0];
  const times =
    typeof first === "object" && first !== null && "time" in first
      ? (events as Series<boolean>).filter((p) => p.value).map((p) => p.time)
      : (events as number[]);
  const indices: number[] = [];
  for (const time of times) {
    const idx = timeToIndex.get(time);
    if (idx !== undefined) indices.push(idx);
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * Run an event study on a detector's firings.
 *
 * @param candles - The candles the events were detected on
 * @param events - Event bar timestamps (epoch ms, matching `candle.time`) or a
 *   `Series<boolean>` whose `true` entries mark events (e.g. `crossOver(...)`)
 * @param options - Horizons, baseline, bootstrap and de-duplication options
 * @returns Per-horizon forward-return distributions with significance tests
 *
 * @example
 * ```ts
 * import { fairValueGap, eventStudy } from "trendcraft";
 *
 * const events = fairValueGap(candles)
 *   .filter((p) => p.value.newBullishFvg)
 *   .map((p) => p.time);
 * const study = eventStudy(candles, events, { horizons: [1, 5, 10] });
 * for (const h of study.horizons) {
 *   console.log(h.horizon, h.meanAbnormalReturn, h.bootstrapPValue, h.hitRate);
 * }
 * ```
 */
export function eventStudy(
  candles: NormalizedCandle[],
  events: number[] | Series<boolean>,
  options: EventStudyOptions = {},
): EventStudyResult {
  const {
    horizons = [1, 5, 10, 20],
    baseline = "mean-adjusted",
    bootstrap = 1000,
    seed = 42,
    minSeparation = 0,
  } = options;

  const timeToIndex = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) timeToIndex.set(candles[i].time, i);

  // Resolve to sorted unique indices, then thin overlapping events.
  const allIndices = toEventIndices(events, timeToIndex);
  const eventIndices: number[] = [];
  for (const idx of allIndices) {
    if (eventIndices.length === 0 || idx - eventIndices[eventIndices.length - 1] >= minSeparation) {
      eventIndices.push(idx);
    }
  }

  const maxHorizon = horizons.length > 0 ? Math.max(...horizons) : 0;
  let overlappingEvents = 0;
  for (let i = 1; i < eventIndices.length; i++) {
    if (eventIndices[i] - eventIndices[i - 1] < maxHorizon) overlappingEvents++;
  }

  // One deterministic RNG shared across horizons.
  const rng = mulberry32(seed);

  const horizonStats: EventHorizonStats[] = horizons.map((h) => {
    // Precompute every valid forward return for this horizon once; the baseline
    // mean, the event returns and the bootstrap all sample from this array
    // (an event at bar `idx` is itself a valid start, since `idx + h ≤ len-1`).
    const validStarts = candles.length - h;
    const fwd: number[] = [];
    for (let i = 0; i < validStarts; i++) fwd.push(forwardReturn(candles, i, h));
    let baselineSum = 0;
    for (const r of fwd) baselineSum += r;
    const baselineMean = validStarts > 0 ? baselineSum / validStarts : Number.NaN;

    const eventReturns: number[] = [];
    let wins = 0;
    for (const idx of eventIndices) {
      if (idx >= validStarts) continue;
      const r = fwd[idx];
      eventReturns.push(r);
      if (r > 0) wins++;
    }

    const n = eventReturns.length;
    const reference = baseline === "raw" ? 0 : baselineMean;

    let mean = 0;
    for (const r of eventReturns) mean += r;
    mean = n > 0 ? mean / n : Number.NaN;

    const std = sampleStd(eventReturns);
    const meanAbnormal = mean - reference;
    const tStat = n >= 2 && std > 0 ? (Math.sqrt(n) * meanAbnormal) / std : Number.NaN;

    // Pseudo-event bootstrap of the abnormal return: draw `n` random start bars
    // `B` times to get the sampling distribution of the mean forward return.
    // Random pseudo-events inherit the series' drift, so their means sit at
    // `baselineMean`; centring each draw on `baselineMean` imposes the null (no
    // abnormal return) and yields the zero-mean sampling noise. The observed
    // statistic is the abnormal return `mean − reference` (deviation from the
    // unconditional mean for "mean-adjusted", from zero for "raw"), so the test
    // stays consistent with the t-test under either baseline.
    let bootstrapPValue = Number.NaN;
    if (bootstrap > 0 && n > 0 && validStarts > 0) {
      const observedDev = Math.abs(meanAbnormal);
      let atLeastAsExtreme = 0;
      for (let b = 0; b < bootstrap; b++) {
        let sampleSum = 0;
        for (let k = 0; k < n; k++) sampleSum += fwd[Math.floor(rng() * validStarts)];
        if (Math.abs(sampleSum / n - baselineMean) >= observedDev) atLeastAsExtreme++;
      }
      bootstrapPValue = (1 + atLeastAsExtreme) / (1 + bootstrap);
    }

    // Sort once for the median and percentiles.
    const sorted = n > 0 ? [...eventReturns].sort((a, b) => a - b) : [];
    const median = percentileSorted(sorted, 50);

    return {
      horizon: h,
      n,
      meanReturn: mean,
      medianReturn: median,
      unconditionalMeanReturn: baselineMean,
      meanAbnormalReturn: meanAbnormal,
      stdReturn: std,
      tStat,
      pValue: twoSidedP(tStat),
      bootstrapPValue,
      bootstrapPValueAdjusted: Number.NaN, // filled in after all horizons
      hitRate: n > 0 ? wins / n : Number.NaN,
      hitRatePValue: binomialTwoSidedP(wins, n),
      skewness: skewness(eventReturns),
      kurtosis: kurtosis(eventReturns),
      percentiles: {
        p5: percentileSorted(sorted, 5),
        p25: percentileSorted(sorted, 25),
        p50: median,
        p75: percentileSorted(sorted, 75),
        p95: percentileSorted(sorted, 95),
      },
    };
  });

  const adjusted = benjaminiHochberg(horizonStats.map((s) => s.bootstrapPValue));
  for (let i = 0; i < horizonStats.length; i++) {
    horizonStats[i].bootstrapPValueAdjusted = adjusted[i];
  }

  return {
    eventCount: eventIndices.length,
    baseline,
    horizons: horizonStats,
    overlappingEvents,
  };
}
