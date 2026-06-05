import { z } from "zod";
import { type CandleStore, defaultCandleStore } from "../dispatcher/candle-store";
import {
  defaultFiresAt,
  getSignalDescriptor,
  listSupportedSignals,
} from "../dispatcher/signal-map";
import { type CandlesInput, candlesInputShape, resolveCandlesInput } from "../schemas/candle";
import { validateIndicatorParams } from "../validation/params";

export const detectSignalInputShape = {
  kind: z.string().min(1),
  ...candlesInputShape,
  params: z.record(z.string(), z.unknown()).optional(),
  /**
   * Slice the trailing N entries of the output. Defaults to 200 to stay
   * inside MCP token budgets. Pass 0 to return the full output (expensive).
   */
  lastN: z.number().int().nonnegative().optional(),
};

export interface DetectSignalResult {
  kind: string;
  shape: "series" | "events";
  count: number;
  totalLength: number;
  truncated: boolean;
  output: unknown[];
  /**
   * Times where a `series`-shape signal was truthy (i.e. cross fired). For
   * `events` shape, this is the times of every event in the sliced output.
   * Provided as a token-cheap screening summary.
   */
  firedAt: number[];
  /**
   * Number of input candle bars the signal was evaluated against. Lets the
   * caller distinguish "no events fired" from "no data was processed" — the
   * two are indistinguishable on `events`-shape outputs from `totalLength`
   * alone (which counts events, not bars).
   */
  processedBars: number;
  /** Echoed from the handle when the caller used `candlesRef`. Omitted otherwise. */
  symbol?: string;
}

const DEFAULT_LAST_N = 200;

const MISSING_PARAMS_RE = /Cannot (destructure property|read propert(?:y|ies))/i;

export function detectSignalHandler(
  input: CandlesInput & {
    kind: string;
    params?: Record<string, unknown>;
    lastN?: number;
  },
  store: CandleStore = defaultCandleStore,
): DetectSignalResult {
  const resolved = resolveCandlesInput(input, store);
  const { candles } = resolved;

  const desc = getSignalDescriptor(input.kind);
  if (!desc) {
    const supported = listSupportedSignals().map((s) => s.kind);
    throw new Error(
      `UNSUPPORTED_SIGNAL: "${input.kind}" is not a supported detect_signal kind. Supported (${supported.length}): ${supported.join(", ")}.`,
    );
  }

  // Structural / wrong-type check (NaN, nested object, string-where-
  // number-expected). Per-signal contracts are still enforced by the
  // underlying signal function.
  validateIndicatorParams(input.kind, input.params);

  // `trendcraft`'s signal functions require a numeric `volume`, but the
  // MCP candle schema allows it to be omitted (price-only callers).
  //
  // A signal reads volume either intrinsically (the `usesVolume` kinds) or
  // dynamically, when the caller routes a price-source option onto volume
  // (`source: "volume"`, read via `getPrice`). In both cases it must see real
  // volume on every bar: zero-filling a missing one would feed a synthetic
  // zero into the computation and could fabricate a signal, so reject the
  // input instead. Price-only reads ignore volume, so a missing one is
  // filled with 0 to satisfy `trendcraft`'s numeric-volume contract.
  const readsVolume = desc.usesVolume === true || input.params?.source === "volume";
  if (readsVolume) {
    // Reject a non-finite volume (undefined, or NaN/Infinity if a caller reached
    // the handler bypassing the schema): a fabricated 0 would distort the volume
    // average, and a NaN would silently poison the result.
    const missing = candles.filter((c) => !Number.isFinite(c.volume)).length;
    if (missing > 0) {
      throw new Error(
        `INVALID_INPUT: signal "${input.kind}" reads volume, but ${missing} of ${candles.length} candle(s) omit it or supply a non-finite value. Provide a finite volume on every bar, or choose a price-only signal.`,
      );
    }
  }
  const resolvedCandles = candles.map((c) => ({
    ...c,
    volume: Number.isFinite(c.volume) ? (c.volume as number) : 0,
  }));

  let raw: unknown;
  try {
    raw = desc.fn(resolvedCandles, input.params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (MISSING_PARAMS_RE.test(message)) {
      throw new Error(
        `INVALID_PARAMETER: signal "${input.kind}" requires a params object — paramsHint: ${desc.paramsHint}. (underlying: ${message})`,
      );
    }
    if (/must be|invalid|positive|less than|greater than/i.test(message)) {
      throw new Error(`INVALID_PARAMETER: ${message}`);
    }
    if (/not enough|insufficient|need at least/i.test(message)) {
      throw new Error(`INSUFFICIENT_DATA: ${message}`);
    }
    throw new Error(`SIGNAL_ERROR: ${message}`);
  }

  if (!Array.isArray(raw)) {
    throw new Error(`INTERNAL_ERROR: signal "${input.kind}" did not return an array`);
  }

  const totalLength = raw.length;
  const lastN = input.lastN === undefined ? DEFAULT_LAST_N : input.lastN;
  const sliced = lastN === 0 || lastN >= totalLength ? raw : raw.slice(totalLength - lastN);

  let firedAt: number[];
  if (desc.shape === "series") {
    const firesAt = desc.firesAt ?? defaultFiresAt;
    firedAt = [];
    for (const point of sliced as Array<{ time: number; value: unknown }>) {
      if (!point || typeof point !== "object") continue;
      if (firesAt(point.value)) firedAt.push(point.time);
    }
  } else {
    firedAt = [];
    for (const evt of sliced as Array<Record<string, unknown>>) {
      if (evt && typeof evt === "object" && typeof evt.time === "number") {
        firedAt.push(evt.time);
      }
    }
  }

  return {
    kind: input.kind,
    shape: desc.shape,
    count: sliced.length,
    totalLength,
    truncated: sliced.length < totalLength,
    output: sliced,
    firedAt,
    processedBars: candles.length,
    ...(resolved.symbol !== undefined ? { symbol: resolved.symbol } : {}),
  };
}
