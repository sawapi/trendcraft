/**
 * Incremental Bollinger Squeeze Detector
 *
 * Detects Bollinger Band squeeze conditions (low volatility) and their release.
 * A squeeze occurs when bandwidth falls below a threshold, and ends when it
 * rises back above.
 *
 * @example
 * ```ts
 * const squeeze = createSqueezeDetector({ bandwidthThreshold: 0.05 });
 * for (const candle of stream) {
 *   const bb = bbIndicator.next(candle).value;
 *   const result = squeeze.next(bb.bandwidth);
 *   if (result.squeezeStart) console.log('Squeeze started - low volatility');
 *   if (result.squeezeEnd) console.log('Squeeze released - breakout likely');
 * }
 * ```
 */

import type { SqueezeDetector, SqueezeDetectorState } from "../types";

/**
 * Options for creating a SqueezeDetector
 */
export type SqueezeDetectorOptions = {
  /** Bandwidth threshold below which a squeeze is active (default: 0.1) */
  bandwidthThreshold?: number;
};

/**
 * Create a Bollinger Band squeeze detector.
 *
 * @param options - Squeeze detection options
 * @param fromState - Optional saved state to restore from
 * @returns A SqueezeDetector instance
 *
 * @example
 * ```ts
 * const detector = createSqueezeDetector({ bandwidthThreshold: 0.05 });
 * detector.next(0.08); // { squeezeStart: false, squeezeEnd: false, inSqueeze: false }
 * detector.next(0.04); // { squeezeStart: true, squeezeEnd: false, inSqueeze: true }
 * detector.next(0.03); // { squeezeStart: false, squeezeEnd: false, inSqueeze: true }
 * detector.next(0.06); // { squeezeStart: false, squeezeEnd: true, inSqueeze: false }
 * ```
 */
export function createSqueezeDetector(
  options: SqueezeDetectorOptions = {},
  fromState?: SqueezeDetectorState,
): SqueezeDetector {
  const bandwidthThreshold = options.bandwidthThreshold ?? 0.1;

  let prevBandwidth = fromState?.prevBandwidth ?? null;
  let inSqueeze = fromState?.inSqueeze ?? false;
  const squeezeTriggerBandwidth = fromState?.squeezeTriggerBandwidth ?? bandwidthThreshold;

  function detect(
    bandwidth: number | null,
    prev: number | null,
    wasSqueeze: boolean,
  ): { squeezeStart: boolean; squeezeEnd: boolean; inSqueeze: boolean } {
    if (bandwidth === null) {
      return { squeezeStart: false, squeezeEnd: false, inSqueeze: wasSqueeze };
    }

    const isBelowThreshold = bandwidth < squeezeTriggerBandwidth;

    if (!wasSqueeze && isBelowThreshold) {
      return { squeezeStart: true, squeezeEnd: false, inSqueeze: true };
    }

    if (wasSqueeze && !isBelowThreshold) {
      return { squeezeStart: false, squeezeEnd: true, inSqueeze: false };
    }

    return { squeezeStart: false, squeezeEnd: false, inSqueeze: wasSqueeze };
  }

  return {
    next(bandwidth: number | null) {
      const result = detect(bandwidth, prevBandwidth, inSqueeze);
      prevBandwidth = bandwidth;
      inSqueeze = result.inSqueeze;
      return result;
    },

    peek(bandwidth: number | null) {
      return detect(bandwidth, prevBandwidth, inSqueeze);
    },

    getState(): SqueezeDetectorState {
      return { prevBandwidth, squeezeTriggerBandwidth, inSqueeze };
    },
  };
}
