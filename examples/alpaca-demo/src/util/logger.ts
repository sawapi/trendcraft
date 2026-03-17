/**
 * Structured logger — prefix, timestamp, level filtering, and optional JSON output.
 * No external dependencies.
 *
 * @example
 * ```ts
 * import { createLogger, setLogLevel, setJsonOutput } from "./util/logger.js";
 *
 * setLogLevel("debug");
 * setJsonOutput(true);       // Emit JSON lines instead of human-readable text
 *
 * const log = createLogger("SESSION");
 * log.info("Session started", { agents: 5 }); // JSON: {"time":"...","level":"info","prefix":"SESSION","msg":"Session started","agents":5}
 * ```
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLevel: LogLevel = "info";
let jsonOutput = false;

/**
 * Set the minimum log level for all loggers.
 * Messages below this level are silently dropped.
 */
export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

/** Get the current global log level. */
export function getLogLevel(): LogLevel {
  return globalLevel;
}

/**
 * Enable or disable JSON line output.
 * When enabled, all log output is a single JSON object per line.
 */
export function setJsonOutput(enabled: boolean): void {
  jsonOutput = enabled;
}

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function formatJson(level: LogLevel, prefix: string, args: unknown[]): string {
  const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    prefix,
    msg,
  };
  // If the last argument is a plain object, spread its keys into the entry
  const last = args[args.length - 1];
  if (last && typeof last === "object" && !Array.isArray(last) && !(last instanceof Error)) {
    Object.assign(entry, last);
    // Re-build msg without the object
    entry.msg = args
      .slice(0, -1)
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
  }
  return JSON.stringify(entry);
}

/**
 * Create a logger with a fixed prefix.
 *
 * @example
 * ```ts
 * const log = createLogger("INTRA");
 * log.info("Review started");        // [12:30:45] [INTRA] [INFO] Review started
 * log.warn("Rejected:", 3);          // [12:30:45] [INTRA] [WARN] Rejected: 3
 * log.debug("Details", { x: 1 });   // (only shown if logLevel <= debug)
 * ```
 */
export function createLogger(prefix: string): Logger {
  function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[globalLevel];
  }

  function emit(level: LogLevel, args: unknown[]): void {
    if (!shouldLog(level)) return;

    if (jsonOutput) {
      const line = formatJson(level, prefix, args);
      if (level === "error") {
        console.error(line);
      } else if (level === "warn") {
        console.warn(line);
      } else {
        console.log(line);
      }
      return;
    }

    const tag = `[${timestamp()}] [${prefix}] [${level.toUpperCase()}]`;
    if (level === "error") {
      console.error(tag, ...args);
    } else if (level === "warn") {
      console.warn(tag, ...args);
    } else {
      console.log(tag, ...args);
    }
  }

  return {
    debug: (...args) => emit("debug", args),
    info: (...args) => emit("info", args),
    warn: (...args) => emit("warn", args),
    error: (...args) => emit("error", args),
  };
}
