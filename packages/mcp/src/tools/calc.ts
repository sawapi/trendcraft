import { getManifest } from "trendcraft/manifest";
import { z } from "zod";
import { type CandleStore, defaultCandleStore } from "../dispatcher/candle-store";
import { getSafeIndicator, listSupportedKinds } from "../dispatcher/safe-map";
import {
  type Candle,
  type CandlesInput,
  candlesInputShape,
  resolveCandlesInput,
} from "../schemas/candle";

export const calcIndicatorInputShape = {
  kind: z.string().min(1),
  ...candlesInputShape,
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

export function calcIndicatorHandler(
  input: CandlesInput & {
    kind: string;
    params?: Record<string, unknown>;
    lastN?: number;
  },
  store: CandleStore = defaultCandleStore,
): CalcResult {
  const candles = resolveCandlesInput(input, store);

  const fn = getSafeIndicator(input.kind);
  if (!fn) {
    const total = listSupportedKinds().length;
    throw new Error(
      `UNSUPPORTED_KIND: "${input.kind}" has no calc wrapper. Call list_indicators({ calcSupported: true }) to discover all ${total} computable kinds, or get_indicator_manifest("${input.kind}") to confirm whether the kind exists at all.`,
    );
  }

  const raw = (fn as (c: Candle[], p?: unknown) => unknown)(candles, input.params);

  if (!isResultLike(raw)) {
    throw new Error(`INTERNAL_ERROR: indicator "${input.kind}" did not return a Result envelope`);
  }

  if (!raw.ok) {
    let code = raw.error?.code ?? "INDICATOR_ERROR";
    let message = raw.error?.message ?? "indicator failed without message";

    if (code === "INDICATOR_ERROR" && MISSING_PARAMS_RE.test(message)) {
      code = "INVALID_PARAMETER";
      const hint = paramHintFor(input.kind);
      message = hint
        ? `indicator "${input.kind}" requires a params object — paramHints: ${hint}. (underlying: ${message})`
        : `indicator "${input.kind}" requires a params object — call get_indicator_manifest("${input.kind}") for paramHints. (underlying: ${message})`;
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

function paramHintFor(kind: string): string | undefined {
  try {
    const m = getManifest(kind);
    const hints = m?.paramHints;
    if (!hints) return undefined;
    const parts = Object.entries(hints)
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .map(([k, v]) => `${k}: ${v}`);
    return parts.length > 0 ? parts.join("; ") : undefined;
  } catch {
    return undefined;
  }
}
