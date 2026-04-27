import { z } from "zod";
import type { CandleStore } from "../dispatcher/candle-store";

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

// Length validation is handled by the tool handler so that the surfaced
// error follows the canonical INVALID_INPUT envelope instead of a raw zod blob.
export const candlesArraySchema = z.array(candleSchema);

export type Candle = z.infer<typeof candleSchema>;

/**
 * Compact tuple form: `[time, open, high, low, close, volume?]`.
 *
 * ~40% smaller than the canonical object-per-bar shape because field names
 * are not repeated per row. Use on `load_candles` / `calc_indicator` /
 * `detect_signal` via the `candlesArray` parameter.
 */
export const candleTupleSchema = z.union([
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
]);

export const candlesTupleArraySchema = z.array(candleTupleSchema);

export type CandleTuple = z.infer<typeof candleTupleSchema>;

/**
 * Tool input fragments accepting any of:
 *   - `candles` — canonical object-per-bar array
 *   - `candlesArray` — compact tuple form
 *   - `candlesRef` — handle returned from `load_candles`
 *
 * Spread into a tool's `inputSchema` and resolve via `resolveCandlesInput`.
 */
export const candlesInputShape = {
  candles: candlesArraySchema.optional(),
  candlesArray: candlesTupleArraySchema.optional(),
  candlesRef: z.string().min(1).optional(),
};

export interface CandlesInput {
  candles?: Candle[];
  candlesArray?: CandleTuple[];
  candlesRef?: string;
}

function tupleToCandle(t: CandleTuple): Candle {
  const [time, open, high, low, close, volume] = t;
  return volume === undefined
    ? { time, open, high, low, close }
    : { time, open, high, low, close, volume };
}

/**
 * Resolve the three accepted candle input forms to a single canonical
 * `Candle[]`. Throws canonical INVALID_INPUT / INVALID_HANDLE on disagreement.
 */
export function resolveCandlesInput(input: CandlesInput, store: CandleStore): Candle[] {
  const provided = [input.candles, input.candlesArray, input.candlesRef].filter(
    (v) => v !== undefined,
  ).length;

  if (provided === 0) {
    throw new Error(
      "INVALID_INPUT: must provide one of `candles`, `candlesArray`, or `candlesRef`",
    );
  }
  if (provided > 1) {
    throw new Error(
      "INVALID_INPUT: provide exactly one of `candles`, `candlesArray`, or `candlesRef` (not multiple)",
    );
  }

  let candles: Candle[];
  if (input.candlesRef !== undefined) {
    const cached = store.get(input.candlesRef);
    if (!cached) {
      throw new Error(
        `INVALID_HANDLE: candlesRef "${input.candlesRef}" is not in the session cache (evicted, expired, or never loaded). Call load_candles to obtain a fresh handle.`,
      );
    }
    candles = cached;
  } else if (input.candlesArray !== undefined) {
    candles = input.candlesArray.map(tupleToCandle);
  } else {
    candles = input.candles as Candle[];
  }

  if (candles.length === 0) {
    throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
  }
  return candles;
}
