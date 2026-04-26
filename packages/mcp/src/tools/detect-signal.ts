import { z } from "zod";
import { getSignalDescriptor, listSupportedSignals } from "../dispatcher/signal-map";
import { type Candle, candlesArraySchema } from "../schemas/candle";

export const detectSignalInputShape = {
  kind: z.string().min(1),
  candles: candlesArraySchema,
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
}

const DEFAULT_LAST_N = 200;

const MISSING_PARAMS_RE = /Cannot (destructure property|read propert(?:y|ies))/i;

export function detectSignalHandler(input: {
  kind: string;
  candles: Candle[];
  params?: Record<string, unknown>;
  lastN?: number;
}): DetectSignalResult {
  if (!input.candles || input.candles.length === 0) {
    throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
  }

  const desc = getSignalDescriptor(input.kind);
  if (!desc) {
    const supported = listSupportedSignals().map((s) => s.kind);
    throw new Error(
      `UNSUPPORTED_SIGNAL: "${input.kind}" is not a supported detect_signal kind. Supported (${supported.length}): ${supported.join(", ")}.`,
    );
  }

  let raw: unknown;
  try {
    raw = desc.fn(input.candles, input.params);
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
    firedAt = [];
    for (const point of sliced as Array<{ time: number; value: unknown }>) {
      if (!point || typeof point !== "object") continue;
      const v = point.value;
      // Boolean Series<boolean> (e.g. goldenCross): fired iff value === true.
      // Object Series with `formed: true` (e.g. perfectOrder): fired iff just-formed.
      // Other object/scalar values are not surfaced in firedAt — callers should
      // inspect `output` for stateful signals.
      if (v === true) firedAt.push(point.time);
      else if (v && typeof v === "object" && (v as { formed?: unknown }).formed === true)
        firedAt.push(point.time);
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
  };
}
