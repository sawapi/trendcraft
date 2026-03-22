/**
 * Signal Emitter for Streaming Pipeline
 *
 * Wraps a streaming pipeline to emit unified TradeSignal events
 * when entry/exit conditions are met.
 *
 * @example
 * ```ts
 * const emitter = createSignalEmitter({
 *   pipeline: pipelineOptions,
 *   intervalMs: 60000,
 *   onSignal: (signal) => {
 *     console.log(`${signal.action} signal at ${signal.time}`);
 *   },
 * });
 *
 * emitter.onTrade(trade); // processes trades and emits signals
 * ```
 */

import { fromPipelineResult } from "../signals/trade-signal/converters";
import type { NormalizedCandle } from "../types";
import type { TradeSignal } from "../types/trade-signal";
import { createPipeline } from "./pipeline";
import { createTradingSession } from "./session";
import type { PipelineOptions, SessionEvent } from "./types";
import type { Trade } from "./types";

/**
 * Options for creating a SignalEmitter
 */
export type SignalEmitterOptions = {
  /** Candle interval in milliseconds */
  intervalMs: number;
  /** Pipeline configuration */
  pipeline: PipelineOptions;
  /** Callback fired when a trade signal is generated */
  onSignal: (signal: TradeSignal) => void;
  /** Emit partial candle events (default: false) */
  emitPartial?: boolean;
  /** Historical candles for warming up indicators */
  warmUp?: NormalizedCandle[];
};

/**
 * Signal emitter wrapping a TradingSession
 */
export type SignalEmitter = {
  /** Process a trade tick */
  onTrade(trade: Trade): SessionEvent[];
  /** Close the emitter and flush remaining data */
  close(): SessionEvent[];
};

/**
 * Create a signal emitter that converts pipeline results to TradeSignal
 *
 * @param options - Emitter configuration
 * @returns SignalEmitter instance
 *
 * @example
 * ```ts
 * const emitter = createSignalEmitter({
 *   intervalMs: 60000,
 *   pipeline: {
 *     indicators: [{ name: 'rsi14', create: () => incremental.rsi({ period: 14 }) }],
 *     entry: rsiBelow(30),
 *     exit: rsiAbove(70),
 *   },
 *   onSignal: (signal) => console.log(signal),
 * });
 *
 * for (const trade of trades) {
 *   emitter.onTrade(trade);
 * }
 * emitter.close();
 * ```
 */
export function createSignalEmitter(options: SignalEmitterOptions): SignalEmitter {
  const { intervalMs, pipeline: pipelineOptions, onSignal, emitPartial = false, warmUp } = options;

  const session = createTradingSession({
    intervalMs,
    pipeline: pipelineOptions,
    emitPartial,
    warmUp,
  });

  // Create a pipeline instance to get PipelineResult for conversion
  const pipeline = createPipeline(pipelineOptions);

  // Warm up pipeline if needed
  if (warmUp) {
    for (const candle of warmUp) {
      pipeline.next(candle);
    }
  }

  function processEvents(events: SessionEvent[]): SessionEvent[] {
    for (const event of events) {
      if (event.type === "candle") {
        const result = pipeline.next(event.candle);
        const signal = fromPipelineResult(result, event.candle.time, event.candle.close);
        if (signal) {
          onSignal(signal);
        }
      }
    }
    return events;
  }

  return {
    onTrade(trade: Trade): SessionEvent[] {
      const events = session.onTrade(trade);
      return processEvents(events);
    },

    close(): SessionEvent[] {
      const events = session.close();
      return processEvents(events);
    },
  };
}
