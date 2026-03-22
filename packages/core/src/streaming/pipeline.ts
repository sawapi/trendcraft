/**
 * Streaming Pipeline
 *
 * Combines incremental indicators with streaming conditions to create
 * a complete signal evaluation pipeline. Processes one candle at a time
 * with O(1) per-candle cost.
 *
 * @example
 * ```ts
 * import { createPipeline } from 'trendcraft/streaming';
 * import { createRsi, createSma } from 'trendcraft/incremental';
 *
 * const pipeline = createPipeline({
 *   indicators: [
 *     { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *     { name: 'sma20', create: () => createSma({ period: 20 }) },
 *   ],
 *   entry: rsiBelow(30),
 *   exit: rsiAbove(70),
 * });
 *
 * for (const candle of stream) {
 *   const result = pipeline.next(candle);
 *   if (result.entrySignal) console.log('BUY', result.snapshot);
 * }
 * ```
 */

import type { NormalizedCandle } from "../types";
import { evaluateStreamingCondition } from "./conditions/core";
import type {
  IndicatorSnapshot,
  PipelineIndicatorConfig,
  PipelineOptions,
  PipelineResult,
  PipelineState,
  StreamingPipeline,
} from "./types";

type IndicatorInstance = {
  name: string;
  indicator: {
    // biome-ignore lint/suspicious/noExplicitAny: indicator values are heterogeneous
    next(candle: NormalizedCandle): { value: any };
    // biome-ignore lint/suspicious/noExplicitAny: indicator values are heterogeneous
    peek(candle: NormalizedCandle): { value: any };
    getState(): unknown;
  };
};

/**
 * Create indicator instances from config, optionally restoring from saved state.
 */
function createIndicators(
  configs: PipelineIndicatorConfig[],
  savedStates?: { name: string; state: unknown }[],
): IndicatorInstance[] {
  const stateMap = new Map<string, unknown>();
  if (savedStates) {
    for (const s of savedStates) {
      stateMap.set(s.name, s.state);
    }
  }

  return configs.map((config) => ({
    name: config.name,
    indicator: config.create(stateMap.get(config.name)),
  }));
}

/**
 * Build a snapshot object from indicator instances using next().
 */
function buildSnapshot(
  instances: IndicatorInstance[],
  candle: NormalizedCandle,
  method: "next" | "peek",
): IndicatorSnapshot {
  const snapshot: IndicatorSnapshot = {};
  for (const inst of instances) {
    const result = inst.indicator[method](candle);
    snapshot[inst.name] = result.value;
  }
  return snapshot;
}

/**
 * Evaluate all pipeline conditions and return a result.
 */
function evaluate(
  options: PipelineOptions,
  snapshot: IndicatorSnapshot,
  candle: NormalizedCandle,
): PipelineResult {
  const entrySignal = options.entry
    ? evaluateStreamingCondition(options.entry, snapshot, candle)
    : false;

  const exitSignal = options.exit
    ? evaluateStreamingCondition(options.exit, snapshot, candle)
    : false;

  const signals: string[] = [];
  if (options.signals) {
    for (const sig of options.signals) {
      if (evaluateStreamingCondition(sig.condition, snapshot, candle)) {
        signals.push(sig.name);
      }
    }
  }

  return { snapshot, entrySignal, exitSignal, signals };
}

/**
 * Create a streaming pipeline that processes candles through indicators
 * and evaluates conditions.
 *
 * @param options - Pipeline configuration
 * @param fromState - Optional saved state to restore from
 * @returns A StreamingPipeline instance
 *
 * @example
 * ```ts
 * const pipeline = createPipeline({
 *   indicators: [
 *     { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *   ],
 *   entry: rsiBelow(30),
 * });
 * const { entrySignal, snapshot } = pipeline.next(candle);
 * ```
 */
export function createPipeline(
  options: PipelineOptions,
  fromState?: PipelineState,
): StreamingPipeline {
  const instances = createIndicators(options.indicators, fromState?.indicatorStates);

  return {
    next(candle: NormalizedCandle): PipelineResult {
      const snapshot = buildSnapshot(instances, candle, "next");
      return evaluate(options, snapshot, candle);
    },

    peek(candle: NormalizedCandle): PipelineResult {
      const snapshot = buildSnapshot(instances, candle, "peek");
      return evaluate(options, snapshot, candle);
    },

    getState(): PipelineState {
      return {
        indicatorStates: instances.map((inst) => ({
          name: inst.name,
          state: inst.indicator.getState(),
        })),
      };
    },
  };
}
