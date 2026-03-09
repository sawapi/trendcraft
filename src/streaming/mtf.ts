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
import { createCandleResampler } from "./candle-resampler";
import type {
  IndicatorSnapshot,
  MtfSnapshot,
  PipelineIndicatorConfig,
  StreamingMtf,
  StreamingMtfState,
  StreamingMtfTimeframeConfig,
} from "./types";
import type { CandleResampler } from "./types";

type MtfTimeframeInstance = {
  intervalMs: number;
  key: string;
  resampler: CandleResampler;
  indicators: {
    name: string;
    indicator: {
      // biome-ignore lint/suspicious/noExplicitAny: indicator values are heterogeneous
      next(candle: NormalizedCandle): { value: any };
      // biome-ignore lint/suspicious/noExplicitAny: indicator values are heterogeneous
      peek(candle: NormalizedCandle): { value: any };
      getState(): unknown;
    };
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
  // Build a map keyed by intervalMs for state restoration (order-independent)
  const stateMap = new Map<number, StreamingMtfState["timeframes"][0]>();
  if (fromState) {
    for (const tf of fromState.timeframes) {
      stateMap.set(tf.intervalMs, tf);
    }
  }

  const instances: MtfTimeframeInstance[] = options.timeframes.map((tf) => {
    const savedTf = stateMap.get(tf.intervalMs);

    // Build indicator state map for this timeframe
    const indStateMap = new Map<string, unknown>();
    if (savedTf) {
      for (const s of savedTf.indicatorStates) {
        indStateMap.set(s.name, s.state);
      }
    }

    return {
      intervalMs: tf.intervalMs,
      key: intervalToKey(tf.intervalMs),
      resampler: createCandleResampler(
        { targetIntervalMs: tf.intervalMs },
        savedTf?.resamplerState,
      ),
      indicators: tf.indicators.map((config) => ({
        name: config.name,
        indicator: config.create(indStateMap.get(config.name)),
      })),
      lastCompletedCandle: null,
    };
  });

  function processCandle(
    inst: MtfTimeframeInstance,
    candle: NormalizedCandle,
    method: "next" | "peek",
  ): void {
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

  /**
   * Merge a base-timeframe candle into the resampler's current partial candle
   * to produce a hypothetical higher-TF candle for peek evaluation.
   */
  function mergeWithCurrentCandle(
    inst: MtfTimeframeInstance,
    candle: NormalizedCandle,
  ): NormalizedCandle {
    const current = inst.resampler.getCurrentCandle();
    if (!current) {
      // No partial candle yet — use the input candle as-is
      return candle;
    }
    return {
      time: current.time,
      open: current.open,
      high: Math.max(current.high, candle.high),
      low: Math.min(current.low, candle.low),
      close: candle.close,
      volume: current.volume + candle.volume,
    };
  }

  function buildMtfSnapshot(method: "next" | "peek", peekCandle?: NormalizedCandle): MtfSnapshot {
    const snapshot: MtfSnapshot = {};
    for (const inst of instances) {
      const tfSnapshot: IndicatorSnapshot = {};

      if (method === "peek" && peekCandle) {
        // Build a hypothetical merged candle for peek evaluation
        const mergedCandle = mergeWithCurrentCandle(inst, peekCandle);
        for (const ind of inst.indicators) {
          tfSnapshot[ind.name] = ind.indicator.peek(mergedCandle).value;
        }
      } else {
        // Use the current partial candle or last completed for next snapshot
        const currentCandle = inst.resampler.getCurrentCandle();
        for (const ind of inst.indicators) {
          tfSnapshot[ind.name] = ind.indicator.peek(
            currentCandle ??
              inst.lastCompletedCandle ?? {
                time: 0,
                open: 0,
                high: 0,
                low: 0,
                close: 0,
                volume: 0,
              },
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
      return buildMtfSnapshot("peek", candle);
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
