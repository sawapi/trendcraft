/**
 * S/R Zone Clustering
 *
 * Identifies support and resistance zones by collecting price levels from
 * multiple sources (swing points, pivot points, VWAP, volume profile,
 * round numbers, custom levels) and clustering them using K-means++.
 *
 * Each zone is scored by touch count, source diversity, and recency to
 * produce a strength ranking (0-100).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { mulberry32 } from "../../core/random";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { volumeProfile } from "../volume/volume-profile";
import { vwap } from "../volume/vwap";
import { pivotPoints } from "./pivot-points";
import { swingPoints } from "./swing-points";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single price level collected from one of the supported sources. */
export type PriceLevelSource = {
  price: number;
  source: "swing" | "pivot" | "vwap" | "round" | "volumeProfile" | "custom";
  weight?: number;
};

/** A clustered support / resistance zone. */
export type SrZone = {
  /** Weighted centroid of the cluster */
  price: number;
  /** Lower boundary of the zone (centroid − zoneWidth × ATR) */
  low: number;
  /** Upper boundary of the zone (centroid + zoneWidth × ATR) */
  high: number;
  /** Number of raw price levels that fell into this cluster */
  touchCount: number;
  /** Number of unique source types represented */
  sourceDiversity: number;
  /** List of unique source type names */
  sources: string[];
  /** Composite strength score 0-100 */
  strength: number;
};

/** Options for the S/R zone clustering algorithm. */
export type SrZonesOptions = {
  /** Number of zones to find (default: auto based on price range) */
  numZones?: number;
  /** ATR multiplier for zone width (default: 0.5) */
  zoneWidth?: number;
  /** Include round number levels (default: true) */
  includeRoundNumbers?: boolean;
  /** Include swing point levels (default: true) */
  includeSwingPoints?: boolean;
  /** Include pivot point levels (default: true) */
  includePivotPoints?: boolean;
  /** Include VWAP level (default: true) */
  includeVwap?: boolean;
  /** Include volume profile POC/VA levels (default: true) */
  includeVolumeProfile?: boolean;
  /** Custom price levels to include */
  customLevels?: number[];
  /** Swing point lookback (left/right bars, default: 5) */
  swingLookback?: number;
  /** Max K-means iterations (default: 50) */
  maxIterations?: number;
  /**
   * Number of K-means initializations to try, keeping the lowest-inertia run
   * (default: 1). K-means is only locally optimal, so a single initialization
   * can land in a worse clustering; extra restarts make the result more robust.
   * The first restart always uses the deterministic k-means++ seeding, so the
   * default (`1`) reproduces the previous behavior exactly, and any higher value
   * can only match or improve on it.
   */
  restarts?: number;
  /**
   * Seed for the randomized k-means++ seeding used by restarts beyond the first
   * (default: 42). Results are fully deterministic for a given seed.
   */
  seed?: number;
};

/** Result of S/R zone detection. */
export type SrZonesResult = {
  /** Clustered zones sorted by strength descending */
  zones: SrZone[];
  /** All raw price levels collected before clustering */
  rawLevels: PriceLevelSource[];
};

// ---------------------------------------------------------------------------
// Helpers – simple ATR (average true range proxy)
// ---------------------------------------------------------------------------

function simpleAtr(candles: NormalizedCandle[]): number {
  if (candles.length === 0) return 0;
  let sum = 0;
  for (const c of candles) {
    sum += c.high - c.low;
  }
  return sum / candles.length;
}

// ---------------------------------------------------------------------------
// Helpers – round-number interval
// ---------------------------------------------------------------------------

function roundNumberInterval(price: number): number {
  if (price < 10) return 0.5;
  if (price < 100) return 5;
  if (price < 1000) return 50;
  if (price < 10000) return 500;
  return 5000;
}

// ---------------------------------------------------------------------------
// Price level collectors
// ---------------------------------------------------------------------------

function collectSwingLevels(candles: NormalizedCandle[], lookback: number): PriceLevelSource[] {
  const levels: PriceLevelSource[] = [];
  const swings = swingPoints(candles, {
    leftBars: lookback,
    rightBars: lookback,
  });
  for (let i = 0; i < swings.length; i++) {
    const v = swings[i].value;
    if (v.isSwingHigh) {
      levels.push({ price: candles[i].high, source: "swing", weight: 1 });
    }
    if (v.isSwingLow) {
      levels.push({ price: candles[i].low, source: "swing", weight: 1 });
    }
  }
  return levels;
}

function collectPivotLevels(candles: NormalizedCandle[]): PriceLevelSource[] {
  const levels: PriceLevelSource[] = [];
  const pivots = pivotPoints(candles);
  // Take the last computed pivot set (most recent)
  for (let i = pivots.length - 1; i >= 0; i--) {
    const v = pivots[i].value;
    if (v.pivot !== null) {
      levels.push({ price: v.pivot, source: "pivot", weight: 1 });
      if (v.r1 !== null) levels.push({ price: v.r1, source: "pivot", weight: 0.8 });
      if (v.r2 !== null) levels.push({ price: v.r2, source: "pivot", weight: 0.6 });
      if (v.s1 !== null) levels.push({ price: v.s1, source: "pivot", weight: 0.8 });
      if (v.s2 !== null) levels.push({ price: v.s2, source: "pivot", weight: 0.6 });
      break; // only use the latest pivot bar
    }
  }
  return levels;
}

function collectVwapLevel(candles: NormalizedCandle[]): PriceLevelSource[] {
  const levels: PriceLevelSource[] = [];
  const v = vwap(candles);
  if (v.length > 0) {
    const last = v[v.length - 1].value;
    if (last && last.vwap !== null) {
      levels.push({ price: last.vwap, source: "vwap", weight: 1 });
    }
  }
  return levels;
}

function collectVolumeProfileLevels(candles: NormalizedCandle[]): PriceLevelSource[] {
  const levels: PriceLevelSource[] = [];
  const vp = volumeProfile(candles);
  if (vp.poc > 0) {
    levels.push({ price: vp.poc, source: "volumeProfile", weight: 1.2 });
  }
  if (vp.vah > 0) {
    levels.push({ price: vp.vah, source: "volumeProfile", weight: 0.8 });
  }
  if (vp.val > 0) {
    levels.push({ price: vp.val, source: "volumeProfile", weight: 0.8 });
  }
  return levels;
}

function collectRoundNumbers(candles: NormalizedCandle[]): PriceLevelSource[] {
  if (candles.length === 0) return [];
  let hi = Number.NEGATIVE_INFINITY;
  let lo = Number.POSITIVE_INFINITY;
  for (const c of candles) {
    if (c.high > hi) hi = c.high;
    if (c.low < lo) lo = c.low;
  }
  const interval = roundNumberInterval((hi + lo) / 2);
  const start = Math.ceil(lo / interval) * interval;
  const levels: PriceLevelSource[] = [];
  for (let p = start; p <= hi; p += interval) {
    levels.push({ price: p, source: "round", weight: 0.5 });
  }
  return levels;
}

// ---------------------------------------------------------------------------
// K-means++ clustering (1D, weighted)
// ---------------------------------------------------------------------------

interface KMeansInput {
  price: number;
  weight: number;
  index: number; // original position (for recency)
}

/**
 * The k-means++ D² term: for each point, the squared distance to its nearest
 * already-chosen center, weighted by the point's weight. Shared by both the
 * deterministic and randomized seeding variants.
 */
function weightedNearestDist2(data: KMeansInput[], centers: number[]): number[] {
  return data.map((d) => {
    let minD = Number.POSITIVE_INFINITY;
    for (const ctr of centers) {
      const dd = (d.price - ctr) ** 2;
      if (dd < minD) minD = dd;
    }
    return minD * d.weight;
  });
}

/**
 * Deterministic k-means++ initialization: first center is the price-median
 * point, then each subsequent center is the point with the largest weighted
 * squared distance from the nearest chosen center (a greedy, reproducible
 * farthest-point rule).
 */
function kmeansppInit(data: KMeansInput[], k: number): number[] {
  if (data.length === 0 || k <= 0) return [];
  const centers: number[] = [];

  // First center: use weighted median-like approach (pick middle element)
  const sorted = [...data].sort((a, b) => a.price - b.price);
  centers.push(sorted[Math.floor(sorted.length / 2)].price);

  for (let c = 1; c < k; c++) {
    const dist2 = weightedNearestDist2(data, centers);

    const totalDist = dist2.reduce((s, v) => s + v, 0);
    if (totalDist === 0) {
      // All remaining points are on existing centers; duplicate last
      centers.push(centers[centers.length - 1]);
      continue;
    }

    // Pick the point with the largest weighted distance (deterministic)
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < dist2.length; i++) {
      if (dist2[i] > bestVal) {
        bestVal = dist2[i];
        bestIdx = i;
      }
    }
    centers.push(data[bestIdx].price);
  }

  return centers;
}

/**
 * Pick an index with probability proportional to `weights`, given a uniform
 * draw `r` in `[0, sum(weights))`. The caller scales its random number by the
 * weight total before calling.
 */
function weightedPick(weights: number[], r: number): number {
  let acc = r;
  for (let i = 0; i < weights.length; i++) {
    acc -= weights[i];
    if (acc < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Randomized k-means++ initialization: the canonical D²-weighted seeding. The
 * first center is sampled proportional to point weight, and each subsequent
 * center proportional to its weighted squared distance from the nearest chosen
 * center. Used for the extra restarts so they explore different starts than the
 * deterministic {@link kmeansppInit}.
 */
function kmeansppInitSeeded(data: KMeansInput[], k: number, rng: () => number): number[] {
  if (data.length === 0 || k <= 0) return [];
  const centers: number[] = [];

  // First center: sample proportional to weight.
  const weights = data.map((d) => d.weight);
  const totalWeight = weights.reduce((s, v) => s + v, 0);
  centers.push(
    totalWeight > 0 ? data[weightedPick(weights, rng() * totalWeight)].price : data[0].price,
  );

  for (let c = 1; c < k; c++) {
    const dist2 = weightedNearestDist2(data, centers);

    const totalDist = dist2.reduce((s, v) => s + v, 0);
    if (totalDist === 0) {
      // All remaining points coincide with existing centers; duplicate last.
      centers.push(centers[centers.length - 1]);
      continue;
    }
    centers.push(data[weightedPick(dist2, rng() * totalDist)].price);
  }

  return centers;
}

/** Weighted within-cluster sum of squares (the k-means objective). */
function computeInertia(data: KMeansInput[], centers: number[], assignments: number[]): number {
  let inertia = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i].price - centers[assignments[i]];
    inertia += data[i].weight * d * d;
  }
  return inertia;
}

/** Run Lloyd's algorithm to convergence from a fixed set of initial centers. */
function runKmeans(
  data: KMeansInput[],
  effectiveK: number,
  maxIter: number,
  initCenters: number[],
): { centers: number[]; assignments: number[] } {
  let centers = initCenters;
  let assignments = new Array<number>(data.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest center
    const newAssign = data.map((d) => {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.abs(d.price - centers[c]);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return best;
    });

    // Recompute centers as weighted means
    const newCenters: number[] = new Array(effectiveK).fill(0);
    const weights: number[] = new Array(effectiveK).fill(0);
    for (let i = 0; i < data.length; i++) {
      const c = newAssign[i];
      newCenters[c] += data[i].price * data[i].weight;
      weights[c] += data[i].weight;
    }
    for (let c = 0; c < effectiveK; c++) {
      if (weights[c] > 0) {
        newCenters[c] /= weights[c];
      } else {
        newCenters[c] = centers[c]; // keep old center for empty cluster
      }
    }

    // Check convergence
    let converged = true;
    for (let c = 0; c < effectiveK; c++) {
      if (Math.abs(newCenters[c] - centers[c]) > 1e-10) {
        converged = false;
        break;
      }
    }

    centers = newCenters;
    assignments = newAssign;
    if (converged) break;
  }

  return { centers, assignments };
}

/**
 * Cluster the price levels with K-means, optionally retrying from several
 * initializations and keeping the lowest-inertia result. Restart 0 always uses
 * the deterministic {@link kmeansppInit} (so `restarts === 1` matches the prior
 * behavior); restarts 1..n use seeded randomized k-means++.
 */
function kmeansCluster(
  data: KMeansInput[],
  k: number,
  maxIter: number,
  restarts: number,
  seed: number,
): { centers: number[]; assignments: number[] } {
  if (data.length === 0) return { centers: [], assignments: [] };
  const effectiveK = Math.min(k, data.length);

  // Restart 0: deterministic init (so restarts === 1 matches prior behavior).
  let best = runKmeans(data, effectiveK, maxIter, kmeansppInit(data, effectiveK));
  if (restarts <= 1) return best;

  // Extra restarts: seeded randomized k-means++; keep the lowest-inertia run.
  let bestInertia = computeInertia(data, best.centers, best.assignments);
  const rng = mulberry32(seed);
  for (let r = 1; r < restarts; r++) {
    const candidate = runKmeans(
      data,
      effectiveK,
      maxIter,
      kmeansppInitSeeded(data, effectiveK, rng),
    );
    const inertia = computeInertia(data, candidate.centers, candidate.assignments);
    if (inertia < bestInertia) {
      best = candidate;
      bestInertia = inertia;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Compute S/R zones by clustering price levels from multiple sources.
 *
 * Collects swing points, pivot points, VWAP, volume profile POC/VA, round
 * numbers, and optional custom levels, then runs 1-D K-means++ clustering
 * to merge nearby levels into ranked zones.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Configuration for source selection and clustering
 * @returns Clustered zones and raw levels
 *
 * @example
 * ```ts
 * import { srZones } from "trendcraft";
 *
 * const result = srZones(candles);
 * console.log(`Found ${result.zones.length} S/R zones`);
 * for (const z of result.zones) {
 *   console.log(`Zone ${z.price.toFixed(2)} (${z.low.toFixed(2)}-${z.high.toFixed(2)}) strength=${z.strength}`);
 * }
 * ```
 */
export function srZones(
  candles: Candle[] | NormalizedCandle[],
  options: SrZonesOptions = {},
): SrZonesResult {
  const {
    numZones,
    zoneWidth = 0.5,
    includeRoundNumbers = true,
    includeSwingPoints = true,
    includePivotPoints = true,
    includeVwap = true,
    includeVolumeProfile = true,
    customLevels,
    swingLookback = 5,
    maxIterations = 50,
    restarts = 1,
    seed = 42,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return { zones: [], rawLevels: [] };
  }

  // 1. Collect price levels from enabled sources
  const rawLevels: PriceLevelSource[] = [];

  if (includeSwingPoints) {
    rawLevels.push(...collectSwingLevels(normalized, swingLookback));
  }
  if (includePivotPoints) {
    rawLevels.push(...collectPivotLevels(normalized));
  }
  if (includeVwap) {
    rawLevels.push(...collectVwapLevel(normalized));
  }
  if (includeVolumeProfile) {
    rawLevels.push(...collectVolumeProfileLevels(normalized));
  }
  if (includeRoundNumbers) {
    rawLevels.push(...collectRoundNumbers(normalized));
  }
  if (customLevels) {
    for (const p of customLevels) {
      rawLevels.push({ price: p, source: "custom", weight: 1 });
    }
  }

  if (rawLevels.length === 0) {
    return { zones: [], rawLevels };
  }

  // 2. Prepare K-means input
  const kInput: KMeansInput[] = rawLevels.map((l, i) => ({
    price: l.price,
    weight: l.weight ?? 1,
    index: i,
  }));

  const k = numZones ?? Math.min(Math.max(3, Math.floor(rawLevels.length / 3)), 15);

  const { centers, assignments } = kmeansCluster(kInput, k, maxIterations, restarts, seed);

  // 3. Build zones from clusters
  const atrValue = simpleAtr(normalized);
  const halfWidth = zoneWidth * atrValue;
  const totalLevels = rawLevels.length;

  // Group by cluster
  const clusters: Map<number, { levels: PriceLevelSource[]; indices: number[] }> = new Map();
  for (let i = 0; i < assignments.length; i++) {
    const c = assignments[i];
    if (!clusters.has(c)) {
      clusters.set(c, { levels: [], indices: [] });
    }
    const cl = clusters.get(c);
    if (!cl) continue;
    cl.levels.push(rawLevels[i]);
    cl.indices.push(i);
  }

  const zones: SrZone[] = [];
  for (const [cIdx, cluster] of clusters) {
    const centroid = centers[cIdx];
    if (!Number.isFinite(centroid)) continue;

    const touchCount = cluster.levels.length;
    const uniqueSources = [...new Set(cluster.levels.map((l) => l.source))];
    const sourceDiversity = uniqueSources.length;

    // Recency: average normalized position (higher = more recent)
    const avgPosition =
      totalLevels > 1
        ? cluster.indices.reduce((s, idx) => s + idx, 0) /
          cluster.indices.length /
          (totalLevels - 1)
        : 1;

    // Strength scoring: touchCount (40%) + sourceDiversity (40%) + recency (20%)
    const maxTouch = rawLevels.length; // theoretical max
    const touchScore = Math.min(touchCount / Math.max(maxTouch * 0.3, 1), 1);
    const diversityScore = Math.min(sourceDiversity / 4, 1); // 4 sources = max
    const recencyScore = avgPosition; // 0-1

    const strength = Math.round(touchScore * 40 + diversityScore * 40 + recencyScore * 20);

    zones.push({
      price: centroid,
      low: centroid - halfWidth,
      high: centroid + halfWidth,
      touchCount,
      sourceDiversity,
      sources: uniqueSources,
      strength: Math.min(100, Math.max(0, strength)),
    });
  }

  // 4. Sort by strength descending
  zones.sort((a, b) => b.strength - a.strength);

  return { zones, rawLevels };
}

/**
 * Rolling S/R zones — compute `srZones` at each bar using a lookback window.
 *
 * Returns a `Series<SrZone[]>` where each element contains the zones computed
 * from the preceding `lookback` bars (or all available bars if fewer).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - S/R zone options (plus optional `lookback`)
 * @param lookback - Number of bars to look back (default: 200)
 * @returns Series of zone arrays, one per bar
 *
 * @example
 * ```ts
 * import { srZonesSeries } from "trendcraft";
 *
 * const series = srZonesSeries(candles, {}, 100);
 * const latestZones = series[series.length - 1].value;
 * console.log(`Current bar has ${latestZones.length} S/R zones`);
 * ```
 */
export function srZonesSeries(
  candles: Candle[] | NormalizedCandle[],
  options: SrZonesOptions = {},
  lookback = 200,
): Series<SrZone[]> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<SrZone[]> = [];

  for (let i = 0; i < normalized.length; i++) {
    const start = Math.max(0, i - lookback + 1);
    const window = normalized.slice(start, i + 1);
    const { zones } = srZones(window, options);
    result.push({ time: normalized[i].time, value: zones });
  }

  return tagSeries(result, { kind: "srZones", overlay: true, label: "S/R Zones" });
}
