import { z } from "zod";
import type { CandleStore } from "../dispatcher/candle-store";

// `.finite()` rejects NaN / ±Infinity: a non-finite OHLCV value poisons every
// downstream indicator/signal with NaN, so it must be refused at the input
// boundary (the same finiteness contract `validateIndicatorParams` enforces on
// params) rather than silently producing a NaN-filled result.
export const candleSchema = z.object({
  time: z.number().finite(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite().optional(),
});

/**
 * Most candles one call (or one `load_candles` handle) may carry. Ten years
 * of daily bars is ~2,500 and a month of one-minute bars ~30,000. The cap
 * bounds what a session retains (up to the store's capacity of handles, each
 * at most this long). It runs after the request has been parsed, so it does
 * not limit the cost of parsing one huge request.
 */
export const MAX_CANDLES = 100_000;

/**
 * Throw the canonical INVALID_INPUT envelope unless `count` is within
 * [1, MAX_CANDLES].
 */
export function assertCandleCount(count: number): void {
  if (count === 0) {
    throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
  }
  if (count > MAX_CANDLES) {
    throw new Error(
      `INVALID_INPUT: candles must contain at most ${MAX_CANDLES} entries, got ${count}`,
    );
  }
}

/**
 * The upper bound sits on the array schemas themselves: zod (>= 4.6.6)
 * checks it before walking the elements, while an unbounded array records
 * one issue per invalid element, so a huge array of bad bars could exhaust
 * memory before any handler ran (GHSA-mrhx-c7xc-m3w5). Its message is the
 * handler's INVALID_INPUT wording; the handlers keep assertCandleCount for
 * the lower bound and for candles that arrive by reference.
 */
const MAX_CANDLES_MESSAGE = `INVALID_INPUT: candles must contain at most ${MAX_CANDLES} entries`;

export const candlesArraySchema = z.array(candleSchema).max(MAX_CANDLES, MAX_CANDLES_MESSAGE);

export type Candle = z.infer<typeof candleSchema>;

/**
 * Compact tuple form: `[time, open, high, low, close, volume?]`.
 *
 * ~40% smaller than the canonical object-per-bar shape because field names
 * are not repeated per row. Use on `load_candles` / `calc_indicator` /
 * `detect_signal` via the `candlesArray` parameter.
 */
export const candleTupleSchema = z.union([
  z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
]);

export const candlesTupleArraySchema = z
  .array(candleTupleSchema)
  .max(MAX_CANDLES, MAX_CANDLES_MESSAGE);

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

export interface ResolvedCandles {
  candles: Candle[];
  /** Source the candles came from. `ref` means a `candlesRef` handle was used. */
  source: "inline" | "tuple" | "ref";
  /** Stored on the handle at `load_candles` time. Only ever set when `source === "ref"`. */
  symbol?: string;
  /** Stored on the handle at `load_candles` time. Only ever set when `source === "ref"`. */
  hint?: string;
}

function tupleToCandle(t: CandleTuple): Candle {
  const [time, open, high, low, close, volume] = t;
  return volume === undefined
    ? { time, open, high, low, close }
    : { time, open, high, low, close, volume };
}

/**
 * Resolve the three accepted candle input forms to a single canonical
 * `Candle[]` plus source metadata. Throws canonical INVALID_INPUT /
 * INVALID_HANDLE on disagreement.
 *
 * When the caller supplies `candlesRef`, the handle's `symbol` / `hint` are
 * surfaced on the result so tool handlers can echo them back into their own
 * response (helps the LLM correlate handle → symbol without a side-table).
 */
export function resolveCandlesInput(input: CandlesInput, store: CandleStore): ResolvedCandles {
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
  let source: ResolvedCandles["source"];
  let symbol: string | undefined;
  let hint: string | undefined;

  if (input.candlesRef !== undefined) {
    const entry = store.getEntry(input.candlesRef);
    if (!entry) {
      throw new Error(
        `INVALID_HANDLE: candlesRef "${input.candlesRef}" is not in the session cache (evicted, expired, or never loaded). Call load_candles to obtain a fresh handle.`,
      );
    }
    candles = entry.candles;
    source = "ref";
    symbol = entry.symbol;
    hint = entry.hint;
  } else if (input.candlesArray !== undefined) {
    // Check the count before converting, so an oversized array is not copied.
    assertCandleCount(input.candlesArray.length);
    candles = input.candlesArray.map(tupleToCandle);
    source = "tuple";
  } else {
    candles = input.candles as Candle[];
    source = "inline";
  }

  assertCandleCount(candles.length);
  return { candles, source, ...(symbol ? { symbol } : {}), ...(hint ? { hint } : {}) };
}
