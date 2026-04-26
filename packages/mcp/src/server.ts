import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcIndicatorHandler, calcIndicatorInputShape } from "./tools/calc";
import { detectSignalHandler, detectSignalInputShape } from "./tools/detect-signal";
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
export const SERVER_VERSION = "0.1.0";

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
    "detect_signal",
    {
      description:
        "Detect a trading signal from caller-supplied OHLCV candles. Single-tool dispatcher across crossovers (goldenCross, deadCross), multi-MA alignment (perfectOrder), divergence (rsiDivergence, macdDivergence, obvDivergence), volatility squeeze (bollingerSqueeze), and volume signals (volumeBreakout, volumeAccumulation, volumeMaCross, volumeAboveAverage). " +
        'Output envelope: `{ kind, shape, output, firedAt, count, totalLength, truncated }`. `firedAt` is a token-cheap list of times where the signal triggered — ideal for screening ("did goldenCross fire in the last 5 bars on this symbol?"). `shape` is `series` (boolean per bar) or `events` (sparse event objects). ' +
        "Errors: INVALID_INPUT, INVALID_PARAMETER, INSUFFICIENT_DATA, UNSUPPORTED_SIGNAL, SIGNAL_ERROR. " +
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
        "Inputs: kind (e.g. 'rsi', 'ema', 'ichimoku'), candles ([{time,open,high,low,close,volume?}], must be non-empty), optional params, optional lastN (default 200, 0 = full series). " +
        "Returns Result envelope. Errors use canonical codes: INVALID_INPUT (bad candles), INVALID_PARAMETER (bad/missing params — most indicators require a params object; consult get_indicator_manifest for paramHints), INSUFFICIENT_DATA, UNSUPPORTED_KIND (no calc wrapper for this kind). " +
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
