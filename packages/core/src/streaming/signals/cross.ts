/**
 * Incremental Cross Detectors
 *
 * Detects when one value crosses over or under another, processing one data
 * point at a time. Mirrors the logic in `src/signals/cross.ts` but works
 * incrementally instead of on full series.
 *
 * @example
 * ```ts
 * const detector = createCrossOverDetector();
 * for (const candle of stream) {
 *   const smaVal = smaIndicator.next(candle).value;
 *   const emaVal = emaIndicator.next(candle).value;
 *   if (detector.next(smaVal, emaVal)) {
 *     console.log('SMA crossed above EMA');
 *   }
 * }
 * ```
 */

import type { CrossDetector, CrossDetectorState } from "../types";

/**
 * Create a cross-over detector.
 * Returns true when valueA crosses from below/equal to above valueB.
 *
 * Logic: prevA <= prevB && currA > currB
 *
 * @param fromState - Optional saved state to restore from
 * @returns A CrossDetector instance
 *
 * @example
 * ```ts
 * const crossOver = createCrossOverDetector();
 * crossOver.next(10, 20); // false (first call, no previous)
 * crossOver.next(21, 20); // true  (crossed over)
 * crossOver.next(22, 20); // false (already above, no new cross)
 * ```
 */
export function createCrossOverDetector(fromState?: CrossDetectorState): CrossDetector {
  let prevA = fromState?.prevA ?? null;
  let prevB = fromState?.prevB ?? null;

  function detect(
    currA: number | null,
    currB: number | null,
    pA: number | null,
    pB: number | null,
  ): boolean {
    if (pA === null || pB === null || currA === null || currB === null) {
      return false;
    }
    return pA <= pB && currA > currB;
  }

  return {
    next(valueA: number | null, valueB: number | null): boolean {
      const result = detect(valueA, valueB, prevA, prevB);
      prevA = valueA;
      prevB = valueB;
      return result;
    },

    peek(valueA: number | null, valueB: number | null): boolean {
      return detect(valueA, valueB, prevA, prevB);
    },

    getState(): CrossDetectorState {
      return { prevA, prevB };
    },
  };
}

/**
 * Create a cross-under detector.
 * Returns true when valueA crosses from above/equal to below valueB.
 *
 * Logic: prevA >= prevB && currA < currB
 *
 * @param fromState - Optional saved state to restore from
 * @returns A CrossDetector instance
 *
 * @example
 * ```ts
 * const crossUnder = createCrossUnderDetector();
 * crossUnder.next(20, 10); // false (first call)
 * crossUnder.next(9, 10);  // true  (crossed under)
 * ```
 */
export function createCrossUnderDetector(fromState?: CrossDetectorState): CrossDetector {
  let prevA = fromState?.prevA ?? null;
  let prevB = fromState?.prevB ?? null;

  function detect(
    currA: number | null,
    currB: number | null,
    pA: number | null,
    pB: number | null,
  ): boolean {
    if (pA === null || pB === null || currA === null || currB === null) {
      return false;
    }
    return pA >= pB && currA < currB;
  }

  return {
    next(valueA: number | null, valueB: number | null): boolean {
      const result = detect(valueA, valueB, prevA, prevB);
      prevA = valueA;
      prevB = valueB;
      return result;
    },

    peek(valueA: number | null, valueB: number | null): boolean {
      return detect(valueA, valueB, prevA, prevB);
    },

    getState(): CrossDetectorState {
      return { prevA, prevB };
    },
  };
}
