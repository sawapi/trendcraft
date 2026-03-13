/**
 * Simple structured logger — thin wrapper around console with prefix and level support.
 * No external dependencies.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLevel: LogLevel = "info";

/**
 * Set the minimum log level for all loggers.
 * Messages below this level are silently dropped.
 */
export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Create a logger with a fixed prefix.
 *
 * @example
 * ```ts
 * const log = createLogger("INTRA");
 * log.info("Review started");   // [INTRA] Review started
 * log.warn("Rejected:", 3);     // [INTRA] Rejected: 3
 * ```
 */
export function createLogger(prefix: string): Logger {
  const tag = `[${prefix}]`;

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[globalLevel];
  }

  return {
    debug: (...args) => {
      if (shouldLog("debug")) console.log(tag, ...args);
    },
    info: (...args) => {
      if (shouldLog("info")) console.log(tag, ...args);
    },
    warn: (...args) => {
      if (shouldLog("warn")) console.warn(tag, ...args);
    },
    error: (...args) => {
      if (shouldLog("error")) console.error(tag, ...args);
    },
  };
}
