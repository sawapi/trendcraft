import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcIndicatorHandler, calcIndicatorInputShape } from "./tools/calc";
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
        "List indicator manifest summaries (kind, displayName, oneLiner, category). " +
        "Optional filters: category, regime, timeframe. Use this to discover what indicators exist before calling get_indicator_manifest.",
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
        "Use this to decide whether an indicator fits the user's situation.",
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
    "calc_indicator",
    {
      description:
        "Compute a single indicator on caller-supplied OHLCV candles. " +
        "Inputs: kind (e.g. 'rsi', 'ema', 'ichimoku'), candles ([{time,open,high,low,close,volume?}]), optional params, optional lastN (default 200, 0 = full series). " +
        "Returns Result envelope. Errors surface canonical codes like INVALID_PARAMETER, INSUFFICIENT_DATA, UNSUPPORTED_KIND. " +
        "Note: only ~60 indicators have safe-calc wrappers; the rest exist as manifest entries only — use list_indicators to explore.",
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
