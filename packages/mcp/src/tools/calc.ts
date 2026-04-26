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

export function calcIndicatorHandler(input: {
  kind: string;
  candles: Candle[];
  params?: Record<string, unknown>;
  lastN?: number;
}): CalcResult {
  const fn = getSafeIndicator(input.kind);
  if (!fn) {
    const supported = listSupportedKinds();
    const ellipsis = supported.length > 20 ? ", ..." : "";
    throw new Error(
      `UNSUPPORTED_KIND: "${input.kind}" is not available via calc_indicator. Supported kinds (${supported.length}): ${supported.slice(0, 20).join(", ")}${ellipsis}. Use list_indicators to discover all manifest-described indicators (some have no safe-wrapped calc path yet).`,
    );
  }

  // Safe wrappers accept (candles, options?) and return Result<Series<T>>.
  const raw = (fn as (c: Candle[], p?: unknown) => unknown)(input.candles, input.params);

  if (!isResultLike(raw)) {
    throw new Error(`INTERNAL_ERROR: indicator "${input.kind}" did not return a Result envelope`);
  }

  if (!raw.ok) {
    const code = raw.error?.code ?? "INDICATOR_ERROR";
    const message = raw.error?.message ?? "indicator failed without message";
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
