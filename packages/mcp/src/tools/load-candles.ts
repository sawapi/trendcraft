import { z } from "zod";
import { type CandleStore, defaultCandleStore } from "../dispatcher/candle-store";
import {
  type Candle,
  type CandleTuple,
  candlesArraySchema,
  candlesTupleArraySchema,
} from "../schemas/candle";

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

  const candles: Candle[] =
    input.candlesArray !== undefined
      ? input.candlesArray.map(tupleToCandle)
      : (input.candles as Candle[]);

  if (candles.length === 0) {
    throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
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
