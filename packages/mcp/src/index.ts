/**
 * Public JS/TS surface for `@trendcraft/mcp`.
 *
 * The package's primary consumption mode is the stdio bin (`trendcraft-mcp`).
 * The exports below are for embedders that want to register the same tools
 * inside their own MCP server, or invoke the handlers directly without
 * spinning up a stdio transport.
 */

// Server factory + identity.
export { createServer, SERVER_NAME, SERVER_VERSION } from "./server";

// Tool handlers (use these to invoke a tool's logic without going through MCP).
export {
  type IndicatorSummary,
  formatMarkdownHandler,
  getManifestHandler,
  listIndicatorsHandler,
  suggestForRegimeHandler,
} from "./tools/manifest";
export { type CalcResult, calcIndicatorHandler } from "./tools/calc";
export { type DetectSignalResult, detectSignalHandler } from "./tools/detect-signal";
export { listSignalsHandler } from "./tools/list-signals";

// Dispatcher introspection — what's actually wired up.
export { listSupportedKinds } from "./dispatcher/safe-map";
export {
  type SignalShape,
  type SignalSummary,
  listSupportedSignals,
} from "./dispatcher/signal-map";
