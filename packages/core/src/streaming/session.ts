/**
 * Trading Session Manager
 *
 * End-to-end pipeline: tick → candle → indicator → signal → event.
 * Combines CandleAggregator and StreamingPipeline into a single
 * entry point for real-time trading.
 *
 * @example
 * ```ts
 * import { createTradingSession } from 'trendcraft/streaming';
 * import { createRsi, createSma } from 'trendcraft/incremental';
 *
 * const session = createTradingSession({
 *   intervalMs: 60_000,  // 1-minute candles
 *   pipeline: {
 *     indicators: [
 *       { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *       { name: 'sma20', create: () => createSma({ period: 20 }) },
 *     ],
 *     entry: rsiBelow(30),
 *     exit: rsiAbove(70),
 *   },
 * });
 *
 * // Feed trades from WebSocket
 * ws.on('trade', (data) => {
 *   const events = session.onTrade({
 *     time: data.timestamp,
 *     price: data.price,
 *     volume: data.quantity,
 *   });
 *   for (const event of events) {
 *     if (event.type === 'entry') placeOrder(event);
 *   }
 * });
 * ```
 */

import type { NormalizedCandle } from "../types";
import { createCandleAggregator } from "./candle-aggregator";
import { createPipeline } from "./pipeline";
import type { SessionEvent, SessionOptions, SessionState, Trade, TradingSession } from "./types";

/**
 * Create a trading session that processes trades through the full pipeline.
 *
 * @param options - Session configuration
 * @param fromState - Optional saved state to restore from
 * @returns A TradingSession instance
 *
 * @example
 * ```ts
 * const session = createTradingSession({
 *   intervalMs: 60_000,
 *   pipeline: {
 *     indicators: [
 *       { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *     ],
 *     entry: rsiBelow(30),
 *   },
 * });
 *
 * const events = session.onTrade({ time: Date.now(), price: 100, volume: 10 });
 * ```
 */
export function createTradingSession(
  options: SessionOptions,
  fromState?: SessionState,
): TradingSession {
  const aggregator = createCandleAggregator(
    { intervalMs: options.intervalMs },
    fromState?.aggregatorState,
  );

  const pipeline = createPipeline(options.pipeline, fromState?.pipelineState);

  // Warm up indicators with historical candles (skip if restoring from state)
  if (options.warmUp && !fromState) {
    for (const candle of options.warmUp) {
      pipeline.next(candle);
    }
  }

  /**
   * Check basic OHLC consistency: high >= open,close and low <= open,close
   */
  function isOhlcValid(candle: NormalizedCandle): boolean {
    return (
      candle.high >= candle.open &&
      candle.high >= candle.close &&
      candle.low <= candle.open &&
      candle.low <= candle.close
    );
  }

  function processCandle(candle: NormalizedCandle): SessionEvent[] {
    // Validate OHLC if enabled
    if (options.validateOhlc && !isOhlcValid(candle)) {
      const reason = `Invalid OHLC: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close}`;
      options.onInvalidCandle?.(candle, reason);
      return [];
    }

    const events: SessionEvent[] = [];

    // Emit candle event
    events.push({ type: "candle", candle });

    // Run pipeline
    const result = pipeline.next(candle);

    // Emit named signals
    for (const name of result.signals) {
      events.push({ type: "signal", name, candle });
    }

    // Emit entry/exit events
    if (result.entrySignal) {
      events.push({ type: "entry", snapshot: result.snapshot, candle });
    }
    if (result.exitSignal) {
      events.push({ type: "exit", snapshot: result.snapshot, candle });
    }

    return events;
  }

  return {
    onTrade(trade: Trade): SessionEvent[] {
      const events: SessionEvent[] = [];

      // Feed trade to aggregator
      const completed = aggregator.addTrade(trade);

      // If a candle was completed, process it
      if (completed) {
        events.push(...processCandle(completed));
      }

      // Optionally emit partial candle updates
      if (options.emitPartial) {
        const partial = aggregator.getCurrentCandle();
        if (partial) {
          const peeked = pipeline.peek(partial);
          events.push({
            type: "partial",
            candle: partial,
            snapshot: peeked.snapshot,
          });
        }
      }

      return events;
    },

    close(): SessionEvent[] {
      const events: SessionEvent[] = [];
      const flushed = aggregator.flush();
      if (flushed) {
        events.push(...processCandle(flushed));
      }
      return events;
    },

    getState(): SessionState {
      return {
        aggregatorState: aggregator.getState(),
        pipelineState: pipeline.getState(),
      };
    },
  };
}
