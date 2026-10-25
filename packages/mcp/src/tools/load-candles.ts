import { z } from "zod";
import { type CandleStore, defaultCandleStore } from "../dispatcher/candle-store";
import {
  assertCandleCount,
  type Candle,
  type CandleTuple,
  candlesArraySchema,
  candlesTupleArraySchema,
} from "../schemas/candle";

/** Longest `symbol` a handle may carry. */
export const MAX_SYMBOL_LENGTH = 64;
/** Longest `hint` a handle may carry. */
export const MAX_HINT_LENGTH = 1_000;

export const loadCandlesInputShape = {
  candles: candlesArraySchema.optional(),
  candlesArray: candlesTupleArraySchema.optional(),
  symbol: z.string().min(1).optional(),
  hint: z.string().min(1).optional(),
};

export interface LoadCandlesResult {
  handle: string;
  count: number;
  span: { from: number; to: number };
  symbol?: string;
  hint?: string;
  /** Number of handles currently held by the session-scoped store, including this one. */
  storeSize: number;
  /** LRU capacity — when storeSize would exceed this, the oldest handle is silently evicted. */
  capacity: number;
}

function tupleToCandle(t: CandleTuple): Candle {
  const [time, open, high, low, close, volume] = t;
  return volume === undefined
    ? { time, open, high, low, close }
    : { time, open, high, low, close, volume };
}

export function loadCandlesHandler(
  input: {
    candles?: Candle[];
    candlesArray?: CandleTuple[];
    symbol?: string;
    hint?: string;
  },
  store: CandleStore = defaultCandleStore,
): LoadCandlesResult {
  const provided = [input.candles, input.candlesArray].filter((v) => v !== undefined).length;
  if (provided === 0) {
    throw new Error("INVALID_INPUT: must provide one of `candles` or `candlesArray`");
  }
  if (provided > 1) {
    throw new Error("INVALID_INPUT: provide exactly one of `candles` or `candlesArray`");
  }

  // Check the count before converting, so an oversized tuple array is not
  // copied first.
  assertCandleCount((input.candlesArray ?? (input.candles as Candle[])).length);
  const candles: Candle[] =
    input.candlesArray !== undefined
      ? input.candlesArray.map(tupleToCandle)
      : (input.candles as Candle[]);

  if (input.symbol !== undefined && input.symbol.length > MAX_SYMBOL_LENGTH) {
    throw new Error(
      `INVALID_INPUT: symbol must be at most ${MAX_SYMBOL_LENGTH} characters, got ${input.symbol.length}`,
    );
  }
  if (input.hint !== undefined && input.hint.length > MAX_HINT_LENGTH) {
    throw new Error(
      `INVALID_INPUT: hint must be at most ${MAX_HINT_LENGTH} characters, got ${input.hint.length}`,
    );
  }

  const meta = store.put(candles, { symbol: input.symbol, hint: input.hint });
  return {
    handle: meta.handle,
    count: meta.count,
    span: meta.span,
    ...(meta.symbol !== undefined ? { symbol: meta.symbol } : {}),
    ...(meta.hint !== undefined ? { hint: meta.hint } : {}),
    storeSize: store.size(),
    capacity: store.getCapacity(),
  };
}
