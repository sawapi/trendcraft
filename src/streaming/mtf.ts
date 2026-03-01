/**
 * Streaming Multi-Timeframe (MTF) Context
 *
 * Combines CandleResampler with incremental indicators to maintain
 * indicator values across multiple timeframes from a single candle stream.
 *
 * @example
 * ```ts
 * import { createStreamingMtf } from 'trendcraft/streaming';
 * import { createSma, createRsi } from 'trendcraft/incremental';
 *
 * const mtf = createStreamingMtf({
 *   timeframes: [
 *     {
 *       intervalMs: 300_000,  // 5-min
 *       indicators: [
 *         { name: 'sma20', create: () => createSma({ period: 20 }) },
 *       ],
 *     },
 *     {
 *       intervalMs: 900_000,  // 15-min
 *       indicators: [
 *         { name: 'rsi14', create: () => createRsi({ period: 14 }) },
 *       ],
 *     },
 *   ],
 * });
 *
 * // Feed 1-min candles
 * for (const candle of stream) {
 *   const snapshot = mtf.next(candle);
 *   // snapshot['5m'].sma20, snapshot['15m'].rsi14
 * }
 * ```
 */

import type { NormalizedCandle } from "../types";
import type {
  StreamingMtfTimeframeConfig,
  StreamingMtfState,
  MtfSnapshot,
  IndicatorSnapshot,
  StreamingMtf,
  PipelineIndicatorConfig,
} from "./types";
import { createCandleResampler } from "./candle-resampler";
import type { CandleResampler } from "./types";

type MtfTimeframeInstance = {
  intervalMs: number;
  key: string;
  resampler: CandleResampler;
  indicators: {
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    indicator: { next(candle: NormalizedCandle): { value: any }; peek(candle: NormalizedCandle): { value: any }; getState(): unknown };
  }[];
  lastCompletedCandle: NormalizedCandle | null;
};

/**
 * Convert intervalMs to a human-readable key
 */
function intervalToKey(intervalMs: number): string {
  if (intervalMs < 60_000) return `${intervalMs / 1000}s`;
  if (intervalMs < 3_600_000) return `${intervalMs / 60_000}m`;
  if (intervalMs < 86_400_000) return `${intervalMs / 3_600_000}h`;
  return `${intervalMs / 86_400_000}d`;
}

/**
 * Options for creating a streaming MTF context
 */
export type StreamingMtfOptions = {
  /** Higher-timeframe definitions */
  timeframes: StreamingMtfTimeframeConfig[];
};

/**
 * Create a streaming multi-timeframe context.
 *
 * @param options - MTF configuration
 * @param fromState - Optional saved state to restore from
 * @returns A StreamingMtf instance
 *
 * @example
 * ```ts
 * const mtf = createStreamingMtf({
 *   timeframes: [
 *     { intervalMs: 300_000, indicators: [...] },
 *   ],
 * });
 * ```
 */
export function createStreamingMtf(
  options: StreamingMtfOptions,
  fromState?: StreamingMtfState,
): StreamingMtf {
  const instances: MtfTimeframeInstance[] = options.timeframes.map((tf, i) => {
    const savedTf = fromState?.timeframes[i];
    return {
      intervalMs: tf.intervalMs,
      key: intervalToKey(tf.intervalMs),
      resampler: createCandleResampler(
        { targetIntervalMs: tf.intervalMs },
        savedTf?.resamplerState,
      ),
      indicators: tf.indicators.map((config) => ({
        name: config.name,
        indicator: config.create(),
      })),
      lastCompletedCandle: null,
    };
  });

  function processCandle(inst: MtfTimeframeInstance, candle: NormalizedCandle, method: "next" | "peek"): void {
    if (method === "next") {
      const completed = inst.resampler.addCandle(candle);
      if (completed) {
        inst.lastCompletedCandle = completed;
        for (const ind of inst.indicators) {
          ind.indicator.next(completed);
        }
      }
    }
    // For peek, we don't advance the resampler
  }

  function buildMtfSnapshot(method: "next" | "peek"): MtfSnapshot {
    const snapshot: MtfSnapshot = {};
    for (const inst of instances) {
      const tfSnapshot: IndicatorSnapshot = {};
      // Use the current partial candle for peek or current state for next
      const currentCandle = inst.resampler.getCurrentCandle();
      for (const ind of inst.indicators) {
        if (currentCandle && method === "peek") {
          tfSnapshot[ind.name] = ind.indicator.peek(currentCandle).value;
        } else {
          // Use last computed value from next()
          tfSnapshot[ind.name] = ind.indicator.peek(
            currentCandle ?? inst.lastCompletedCandle ?? { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 },
          ).value;
        }
      }
      snapshot[inst.key] = tfSnapshot;
    }
    return snapshot;
  }

  return {
    next(candle: NormalizedCandle): MtfSnapshot {
      for (const inst of instances) {
        processCandle(inst, candle, "next");
      }
      return buildMtfSnapshot("next");
    },

    peek(candle: NormalizedCandle): MtfSnapshot {
      return buildMtfSnapshot("peek");
    },

    getState(): StreamingMtfState {
      return {
        timeframes: instances.map((inst) => ({
          intervalMs: inst.intervalMs,
          resamplerState: inst.resampler.getState(),
          indicatorStates: inst.indicators.map((ind) => ({
            name: ind.name,
            state: ind.indicator.getState(),
          })),
        })),
      };
    },
  };
}
