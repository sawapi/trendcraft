import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcIndicatorHandler, calcIndicatorInputShape } from "./tools/calc";
import { detectSignalHandler, detectSignalInputShape } from "./tools/detect-signal";
import { listSignalsHandler, listSignalsInputShape } from "./tools/list-signals";
import { loadCandlesHandler, loadCandlesInputShape } from "./tools/load-candles";
import {
  formatMarkdownHandler,
  formatMarkdownInputShape,
  getManifestHandler,
  getManifestInputShape,
  listIndicatorsHandler,
  listIndicatorsInputShape,
  suggestForRegimeHandler,
  suggestForRegimeInputShape,
} from "./tools/manifest";

export const SERVER_NAME = "trendcraft-mcp";
export const SERVER_VERSION = "0.2.0";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "list_indicators",
    {
      description:
        "List indicator manifest summaries (kind, displayName, oneLiner, category, calcSupported). " +
        "Each entry's `calcSupported` flag tells you whether calc_indicator can actually compute that kind. " +
        "Optional filters: category, regime, timeframe, calcSupported. " +
        "Use `{ calcSupported: true }` to restrict to computable kinds before calling calc_indicator.",
      inputSchema: listIndicatorsInputShape,
    },
    async (args) => {
      try {
        return jsonResult(listIndicatorsHandler(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "get_indicator_manifest",
    {
      description:
        "Return the full IndicatorManifest for a single kind: whenToUse, signals, pitfalls, synergy, marketRegime, timeframe, paramHints. " +
        "Use this to decide whether an indicator fits the user's situation, or to look up paramHints before calling calc_indicator. " +
        "Throws UNKNOWN_KIND if no manifest entry exists (distinct from UNSUPPORTED_KIND, which means the manifest entry exists but no calc wrapper is available).",
      inputSchema: getManifestInputShape,
    },
    async (args) => {
      try {
        return jsonResult(getManifestHandler(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "suggest_indicators_for_regime",
    {
      description:
        "Return manifests of indicators well-suited to a given market regime " +
        '("trending" | "ranging" | "volatile" | "low-volatility").',
      inputSchema: suggestForRegimeInputShape,
    },
    async (args) => {
      try {
        return jsonResult(suggestForRegimeHandler(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "format_manifest_markdown",
    {
      description:
        "Render a single indicator's manifest as Markdown — useful for embedding in agent prompts or documentation.",
      inputSchema: formatMarkdownInputShape,
    },
    async (args) => {
      try {
        return textResult(formatMarkdownHandler(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "list_signals",
    {
      description:
        "List signal kinds supported by detect_signal. Each summary includes `kind`, `shape` (`series` for per-bar boolean/state signals; `events` for sparse event arrays), `oneLiner`, and `paramsHint` so the caller can build a detect_signal request without a round-trip. Optional `shape` filter narrows to one output type.",
      inputSchema: listSignalsInputShape,
    },
    async (args) => {
      try {
        return jsonResult(listSignalsHandler(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "load_candles",
    {
      description:
        "Cache OHLCV candles in the session and return an opaque `handle`. Pass that handle as `candlesRef` on subsequent `calc_indicator` / `detect_signal` calls instead of re-sending the candle array. " +
        "Designed for multi-tool screens: 5 parallel indicator calls against the same 124-bar series transmits the bars 1× total instead of 5×. " +
        "Inputs: provide either `candles` (canonical `[{time,open,high,low,close,volume?}]`) or `candlesArray` (compact tuple form `[[time,open,high,low,close,volume?], ...]`, ~40% smaller). Optional `symbol` and `hint` are stored as metadata for your own bookkeeping. " +
        "Output: `{ handle, count, span: { from, to }, symbol?, hint? }`. " +
        "Lifetime: handles live for the duration of the stdio MCP process only — no persistence, no cross-session sharing. Capacity is 50 handles; oldest is silently evicted. Reload is cheap.",
      inputSchema: loadCandlesInputShape,
    },
    async (args) => {
      try {
        return jsonResult(loadCandlesHandler(args as Parameters<typeof loadCandlesHandler>[0]));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "detect_signal",
    {
      description:
        "Detect a trading signal from caller-supplied OHLCV candles. Single-tool dispatcher across crossovers (goldenCross, deadCross), multi-MA alignment (perfectOrder), divergence (rsiDivergence, macdDivergence, obvDivergence), volatility squeeze (bollingerSqueeze), and volume signals (volumeBreakout, volumeAccumulation, volumeMaCross, volumeAboveAverage). " +
        "Candle input: provide exactly one of `candles` (canonical), `candlesArray` (compact tuple form), or `candlesRef` (handle from `load_candles` — cheapest for repeated calls). " +
        'Output envelope: `{ kind, shape, output, firedAt, count, totalLength, truncated }`. `firedAt` is a token-cheap list of times where the signal triggered — ideal for screening ("did goldenCross fire in the last 5 bars on this symbol?"). `shape` is `series` (boolean per bar) or `events` (sparse event objects). ' +
        "Errors: INVALID_INPUT, INVALID_HANDLE, INVALID_PARAMETER, INSUFFICIENT_DATA, UNSUPPORTED_SIGNAL, SIGNAL_ERROR. " +
        "Note: signal kinds are NOT the same set as calc_indicator kinds — call detect_signal with an unknown kind to see the supported list.",
      inputSchema: detectSignalInputShape,
    },
    async (args) => {
      try {
        return jsonResult(detectSignalHandler(args as Parameters<typeof detectSignalHandler>[0]));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "calc_indicator",
    {
      description:
        "Compute a single indicator on caller-supplied OHLCV candles. " +
        "Inputs: kind (e.g. 'rsi', 'ema', 'ichimoku'); candle input via exactly one of `candles` (canonical `[{time,open,high,low,close,volume?}]`), `candlesArray` (compact tuple form `[[time,open,high,low,close,volume?], ...]`, ~40% smaller), or `candlesRef` (handle from `load_candles` — cheapest for repeated calls); optional params; optional lastN (default 200, 0 = full series). " +
        "Returns Result envelope. Errors use canonical codes: INVALID_INPUT (bad candles), INVALID_HANDLE (stale `candlesRef`), INVALID_PARAMETER (bad/missing params — error message embeds the manifest's paramHints), INSUFFICIENT_DATA, UNSUPPORTED_KIND (no calc wrapper for this kind). " +
        "Discover computable kinds via list_indicators({ calcSupported: true }).",
      inputSchema: calcIndicatorInputShape,
    },
    async (args) => {
      try {
        const result = calcIndicatorHandler(args as Parameters<typeof calcIndicatorHandler>[0]);
        return jsonResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return server;
}
