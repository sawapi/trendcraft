/**
 * Harmonic Pattern Detection
 *
 * Detects Gartley, Butterfly, Bat, Crab, and Shark patterns using
 * Fibonacci ratio validation on XABCD swing point structures.
 */

import { getAlternatingSwingPoints } from "../../indicators/price/swing-points";
import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle } from "../../types";
import type {
  HarmonicPatternOptions,
  HarmonicPatternType,
  PatternKeyPoint,
  PatternSignal,
  PatternType,
} from "./types";

/**
 * Fibonacci ratio rule for a single harmonic pattern
 */
interface HarmonicRule {
  /** Bullish PatternType */
  bullish: PatternType;
  /** Bearish PatternType */
  bearish: PatternType;
  /** AB/XA ratio (exact or [min, max]) */
  abxa: number | [number, number];
  /** BC/AB ratio range */
  bcab: [number, number];
  /** CD/BC ratio range */
  cdbc: [number, number];
  /** AD/XA ratio (exact or [min, max]) */
  adxa: number | [number, number];
}

const HARMONIC_RULES: Record<HarmonicPatternType, HarmonicRule> = {
  gartley: {
    bullish: "gartley_bullish",
    bearish: "gartley_bearish",
    abxa: 0.618,
    bcab: [0.382, 0.886],
    cdbc: [1.13, 1.618],
    adxa: 0.786,
  },
  butterfly: {
    bullish: "butterfly_bullish",
    bearish: "butterfly_bearish",
    abxa: 0.786,
    bcab: [0.382, 0.886],
    cdbc: [1.618, 2.618],
    adxa: [1.27, 1.618],
  },
  bat: {
    bullish: "bat_bullish",
    bearish: "bat_bearish",
    abxa: [0.382, 0.5],
    bcab: [0.382, 0.886],
    cdbc: [1.618, 2.618],
    adxa: 0.886,
  },
  crab: {
    bullish: "crab_bullish",
    bearish: "crab_bearish",
    abxa: [0.382, 0.618],
    bcab: [0.382, 0.886],
    cdbc: [2.24, 3.618],
    adxa: 1.618,
  },
  shark: {
    bullish: "shark_bullish",
    bearish: "shark_bearish",
    abxa: [0.446, 0.618],
    bcab: [1.13, 1.618],
    cdbc: [1.618, 2.236],
    adxa: [0.886, 1.13],
  },
};

const ALL_HARMONIC_TYPES: HarmonicPatternType[] = ["gartley", "butterfly", "bat", "crab", "shark"];

const XABCD_LABELS = ["X", "A", "B", "C", "D"] as const;

/**
 * Check if a ratio matches an exact value within tolerance
 */
function matchesExact(actual: number, ideal: number, tolerance: number): boolean {
  return Math.abs(actual - ideal) / ideal <= tolerance;
}

/**
 * Check if a ratio falls within a range (with tolerance on boundaries)
 */
function matchesRange(actual: number, min: number, max: number, tolerance: number): boolean {
  return actual >= min * (1 - tolerance) && actual <= max * (1 + tolerance);
}

/**
 * Check if a ratio matches a rule (exact value or range)
 */
function matchesRule(actual: number, rule: number | [number, number], tolerance: number): boolean {
  if (typeof rule === "number") {
    return matchesExact(actual, rule, tolerance);
  }
  return matchesRange(actual, rule[0], rule[1], tolerance);
}

/**
 * Calculate deviation from ideal for confidence scoring
 */
function calculateDeviation(actual: number, rule: number | [number, number]): number {
  if (typeof rule === "number") {
    return Math.abs(actual - rule) / rule;
  }
  const mid = (rule[0] + rule[1]) / 2;
  return Math.abs(actual - mid) / mid;
}

/**
 * Calculate confidence score for a harmonic pattern match (0-100)
 * Base 100, deduct up to 25 per leg based on deviation from ideal
 */
function calculateConfidence(
  ratios: { abxa: number; bcab: number; cdbc: number; adxa: number },
  rule: HarmonicRule,
): number {
  const deviations = [
    calculateDeviation(ratios.abxa, rule.abxa),
    calculateDeviation(ratios.bcab, rule.bcab),
    calculateDeviation(ratios.cdbc, rule.cdbc),
    calculateDeviation(ratios.adxa, rule.adxa),
  ];

  let score = 100;
  for (const dev of deviations) {
    // Each leg can deduct up to 25 points; scale deviation so 0.05 (5%) => ~25 pts
    score -= Math.min(25, dev * 500);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Detect harmonic patterns (Gartley, Butterfly, Bat, Crab, Shark)
 *
 * Uses a 5-point XABCD swing structure with Fibonacci ratio validation.
 * Bullish patterns: X(low)-A(high)-B(low)-C(high)-D(low)
 * Bearish patterns: X(high)-A(low)-B(high)-C(low)-D(high)
 *
 * @param candles - Price data (OHLCV)
 * @param options - Detection options
 * @returns Array of detected harmonic pattern signals
 *
 * @example
 * ```ts
 * const patterns = detectHarmonicPatterns(candles);
 * const gartleys = patterns.filter(p => p.type.startsWith("gartley"));
 * ```
 */
export function detectHarmonicPatterns(
  candles: Candle[] | NormalizedCandle[],
  options: HarmonicPatternOptions = {},
): PatternSignal[] {
  const {
    swingLookback = 5,
    tolerance = 0.05,
    minSwingPoints = 50,
    patterns: patternFilter = ALL_HARMONIC_TYPES,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  if (normalized.length < 10) return [];

  // Get enough alternating swing points to form XABCD windows
  const swingCount = Math.max(minSwingPoints, 20);
  const swings = getAlternatingSwingPoints(normalized, swingCount, {
    leftBars: swingLookback,
    rightBars: swingLookback,
  });

  if (swings.length < 5) return [];

  // Track best confidence per D-point time to deduplicate
  const bestByTime = new Map<string, PatternSignal>();

  // Sliding window of 5 consecutive swing points
  for (let i = 0; i <= swings.length - 5; i++) {
    const [X, A, B, C, D] = swings.slice(i, i + 5);

    // Determine direction
    const isBullish =
      X.type === "low" && A.type === "high" && B.type === "low" && C.type === "high" && D.type === "low";
    const isBearish =
      X.type === "high" && A.type === "low" && B.type === "high" && C.type === "low" && D.type === "high";

    if (!isBullish && !isBearish) continue;

    // Calculate leg lengths
    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(D.price - C.price);
    const AD = Math.abs(A.price - D.price);

    // Avoid division by zero
    if (XA === 0 || AB === 0 || BC === 0) continue;

    // Calculate ratios
    const ratios = {
      abxa: AB / XA,
      bcab: BC / AB,
      cdbc: CD / BC,
      adxa: AD / XA,
    };

    // Check against each rule
    for (const patternName of patternFilter) {
      const rule = HARMONIC_RULES[patternName];

      if (
        matchesRule(ratios.abxa, rule.abxa, tolerance) &&
        matchesRule(ratios.bcab, rule.bcab, tolerance) &&
        matchesRule(ratios.cdbc, rule.cdbc, tolerance) &&
        matchesRule(ratios.adxa, rule.adxa, tolerance)
      ) {
        const patternType: PatternType = isBullish ? rule.bullish : rule.bearish;
        const confidence = calculateConfidence(ratios, rule);

        // Target: 0.382 retracement of AD from D
        const adLeg = A.price - D.price; // signed
        const target = D.price + adLeg * 0.382;

        // StopLoss: beyond X
        const stopLoss = isBullish ? X.price * 0.99 : X.price * 1.01;

        const keyPoints: PatternKeyPoint[] = [X, A, B, C, D].map((pt, idx) => ({
          time: pt.time,
          index: pt.index,
          price: pt.price,
          label: XABCD_LABELS[idx],
        }));

        const signal: PatternSignal = {
          time: D.time,
          type: patternType,
          pattern: {
            startTime: X.time,
            endTime: D.time,
            keyPoints,
            target,
            stopLoss,
            height: XA,
          },
          confidence,
          confirmed: true, // Pattern is confirmed at D point
        };

        // Deduplicate: keep highest confidence per (time, patternType)
        const dedupeKey = `${D.time}_${patternType}`;
        const existing = bestByTime.get(dedupeKey);
        if (!existing || existing.confidence < confidence) {
          bestByTime.set(dedupeKey, signal);
        }
      }
    }
  }

  // Collect and sort by time
  return [...bestByTime.values()].sort((a, b) => (a.time as number) - (b.time as number));
}
