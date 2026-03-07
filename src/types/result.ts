/**
 * Result Type for Structured Error Handling
 *
 * Provides a discriminated union Result type for safe error handling
 * in long-running operations (optimization, screening).
 * Zero external dependencies, fully JSON-serializable.
 */

// ============================================
// Core Result Types
// ============================================

/**
 * Successful result wrapper
 */
export type Ok<T> = { readonly ok: true; readonly value: T };

/**
 * Error result wrapper
 */
export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * Discriminated union result type
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) return err(tcError("INVALID_PARAMETER", "Division by zero"));
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E = TrendCraftError> = Ok<T> | Err<E>;

// ============================================
// Error Types
// ============================================

/**
 * Error codes for structured error classification
 */
export type TrendCraftErrorCode =
  | "INVALID_PARAMETER"
  | "MISSING_CONDITION"
  | "INSUFFICIENT_DATA"
  | "INVALID_DATA_FORMAT"
  | "NO_DATA"
  | "TOO_MANY_COMBINATIONS"
  | "NO_VALID_RESULTS"
  | "OPTIMIZATION_FAILED"
  | "BACKTEST_FAILED"
  | "SCREENING_FAILED"
  | "COMPUTATION_FAILED"
  | "INDICATOR_ERROR";

/**
 * Structured error with code, message, and optional context
 */
export type TrendCraftError = {
  readonly code: TrendCraftErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;
};

// ============================================
// Constructor Functions
// ============================================

/**
 * Create a successful result
 *
 * @example
 * ```ts
 * const result = ok(42);
 * // { ok: true, value: 42 }
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 *
 * @example
 * ```ts
 * const result = err(tcError("INVALID_PARAMETER", "Period must be positive"));
 * // { ok: false, error: { code: "INVALID_PARAMETER", message: "..." } }
 * ```
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Create a TrendCraftError
 *
 * @example
 * ```ts
 * const error = tcError("INSUFFICIENT_DATA", "Need at least 20 candles", {
 *   required: 20,
 *   actual: 5,
 * });
 * ```
 */
export function tcError(
  code: TrendCraftErrorCode,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): TrendCraftError {
  const error: TrendCraftError = { code, message };
  if (context !== undefined) {
    (error as { context: Record<string, unknown> }).context = context;
  }
  if (cause !== undefined) {
    (error as { cause: Error }).cause = cause;
  }
  return error;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Transform the value of a successful result
 *
 * @example
 * ```ts
 * const result = ok(5);
 * const doubled = mapResult(result, (x) => x * 2);
 * // { ok: true, value: 10 }
 * ```
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Chain result-returning operations
 *
 * @example
 * ```ts
 * const result = ok(10);
 * const divided = flatMap(result, (x) =>
 *   x > 0 ? ok(100 / x) : err(tcError("INVALID_PARAMETER", "Must be positive"))
 * );
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Extract value from result with a fallback default
 *
 * @example
 * ```ts
 * const result = err(tcError("NO_DATA", "Empty"));
 * const value = unwrapOr(result, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extract value from result or throw on error
 *
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrap(result); // 42
 *
 * const bad = err(tcError("NO_DATA", "Empty"));
 * unwrap(bad); // throws Error("Result error [NO_DATA]: Empty")
 * ```
 */
export function unwrap<T>(result: Result<T, TrendCraftError>): T {
  if (result.ok) {
    return result.value;
  }
  const error = new Error(`Result error [${result.error.code}]: ${result.error.message}`);
  if (result.error.cause) {
    error.cause = result.error.cause;
  }
  throw error;
}

/**
 * Collect an array of results into a result of array.
 * Returns the first error encountered, or Ok with all values.
 *
 * @example
 * ```ts
 * const results = [ok(1), ok(2), ok(3)];
 * const collected = collectResults(results);
 * // { ok: true, value: [1, 2, 3] }
 *
 * const mixed = [ok(1), err(tcError("NO_DATA", "fail")), ok(3)];
 * const collected2 = collectResults(mixed);
 * // { ok: false, error: { code: "NO_DATA", ... } }
 * ```
 */
export function collectResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Split an array of results into successes and failures
 *
 * @example
 * ```ts
 * const results = [ok(1), err(tcError("NO_DATA", "a")), ok(3)];
 * const { successes, failures } = partitionResults(results);
 * // successes: [1, 3]
 * // failures: [{ code: "NO_DATA", ... }]
 * ```
 */
export function partitionResults<T, E>(results: Result<T, E>[]): { successes: T[]; failures: E[] } {
  const successes: T[] = [];
  const failures: E[] = [];
  for (const result of results) {
    if (result.ok) {
      successes.push(result.value);
    } else {
      failures.push(result.error);
    }
  }
  return { successes, failures };
}

/**
 * Wrap a throwing function into a Result-returning function
 *
 * @example
 * ```ts
 * const safeParse = tryCatch(
 *   () => JSON.parse(input),
 *   (e) => tcError("INVALID_DATA_FORMAT", "Invalid JSON", {}, e as Error)
 * );
 * ```
 */
export function tryCatch<T, E>(fn: () => T, onError: (error: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(onError(error));
  }
}

/**
 * Wrap a throwing function into a Result with a default error code
 *
 * Convenience wrapper over `tryCatch` that automatically constructs
 * a `TrendCraftError` from the caught exception.
 *
 * @example
 * ```ts
 * const result = toResult(() => rsi(candles, { period: 14 }));
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export function toResult<T>(
  fn: () => T,
  code: TrendCraftErrorCode = "COMPUTATION_FAILED",
): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
