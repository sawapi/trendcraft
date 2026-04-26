import { z } from "zod";
import { getSafeIndicator, listSupportedKinds } from "../dispatcher/safe-map";
import { type Candle, candlesArraySchema } from "../schemas/candle";

export const calcIndicatorInputShape = {
  kind: z.string().min(1),
  candles: candlesArraySchema,
  params: z.record(z.string(), z.unknown()).optional(),
  /**
   * Slice the trailing N entries of the result series. Defaults to 200 to
   * stay within MCP response token budgets. Pass 0 to return the full series
   * (expensive — only use for short windows or downstream summarization).
   */
  lastN: z.number().int().nonnegative().optional(),
};

export interface CalcResult {
  kind: string;
  count: number;
  truncated: boolean;
  totalLength: number;
  series: unknown[];
}

const DEFAULT_LAST_N = 200;

interface ResultLike {
  ok: boolean;
  value?: unknown;
  error?: { code?: string; message?: string };
}

function isResultLike(x: unknown): x is ResultLike {
  return typeof x === "object" && x !== null && "ok" in x;
}

/**
 * `Cannot destructure property 'X' of 'Y' as it is undefined` and
 * `Cannot read properties of undefined (reading 'X')` both indicate the
 * indicator was called without a required `params` object. Reclassify these
 * from the generic INDICATOR_ERROR bucket into INVALID_PARAMETER so callers
 * (LLMs) can react sensibly.
 */
const MISSING_PARAMS_RE = /Cannot (destructure property|read propert(?:y|ies))/i;

export function calcIndicatorHandler(input: {
  kind: string;
  candles: Candle[];
  params?: Record<string, unknown>;
  lastN?: number;
}): CalcResult {
  if (!input.candles || input.candles.length === 0) {
    throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
  }

  const fn = getSafeIndicator(input.kind);
  if (!fn) {
    const total = listSupportedKinds().length;
    throw new Error(
      `UNSUPPORTED_KIND: "${input.kind}" has no calc wrapper. Call list_indicators({ calcSupported: true }) to discover all ${total} computable kinds, or get_indicator_manifest("${input.kind}") to confirm whether the kind exists at all.`,
    );
  }

  const raw = (fn as (c: Candle[], p?: unknown) => unknown)(input.candles, input.params);

  if (!isResultLike(raw)) {
    throw new Error(`INTERNAL_ERROR: indicator "${input.kind}" did not return a Result envelope`);
  }

  if (!raw.ok) {
    let code = raw.error?.code ?? "INDICATOR_ERROR";
    let message = raw.error?.message ?? "indicator failed without message";

    if (code === "INDICATOR_ERROR" && MISSING_PARAMS_RE.test(message)) {
      code = "INVALID_PARAMETER";
      message = `indicator "${input.kind}" requires a params object — call get_indicator_manifest("${input.kind}") for the paramHints. (underlying: ${message})`;
    }

    throw new Error(`${code}: ${message}`);
  }

  const series = Array.isArray(raw.value) ? (raw.value as unknown[]) : [];
  const totalLength = series.length;
  const lastN = input.lastN === undefined ? DEFAULT_LAST_N : input.lastN;
  const sliced = lastN === 0 || lastN >= totalLength ? series : series.slice(totalLength - lastN);

  return {
    kind: input.kind,
    count: sliced.length,
    totalLength,
    truncated: sliced.length < totalLength,
    series: sliced,
  };
}
