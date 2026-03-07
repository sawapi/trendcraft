/**
 * Resilient execution utilities — exponential backoff retry and polling
 *
 * Broker-agnostic helpers for reliable order execution in automated trading.
 *
 * @example
 * ```ts
 * // Retry an API call with exponential backoff
 * const result = await withRetry(() => api.submitOrder(order), {
 *   maxAttempts: 3,
 *   initialDelayMs: 500,
 * });
 *
 * // Poll until an order is filled
 * const { result: order, settled } = await pollUntil(
 *   () => api.getOrder(orderId),
 *   (o) => o.status === 'filled' || o.status === 'canceled',
 * );
 * ```
 */

import type { PollOptions, RetryOptions } from "./types";

/**
 * Calculate delay with optional jitter
 */
function computeDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean,
): number {
  const base = Math.min(initialDelayMs * backoffMultiplier ** attempt, maxDelayMs);
  if (!jitter) return base;
  // Full jitter: uniform random in [0, base]
  return Math.random() * base;
}

/**
 * Execute a function with exponential backoff retry on failure.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns The result of a successful invocation
 * @throws The last error if all attempts are exhausted
 *
 * @example
 * ```ts
 * const data = await withRetry(() => fetch('/api/order'), {
 *   maxAttempts: 3,
 *   initialDelayMs: 1000,
 *   retryableErrors: (err) => err instanceof NetworkError,
 * });
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 500;
  const maxDelayMs = options?.maxDelayMs ?? 10_000;
  const backoffMultiplier = options?.backoffMultiplier ?? 2;
  const jitter = options?.jitter ?? true;
  const retryableErrors = options?.retryableErrors;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // If not retryable, throw immediately
      if (retryableErrors && !retryableErrors(err)) {
        throw err;
      }

      // If this was the last attempt, throw
      if (attempt === maxAttempts - 1) {
        throw err;
      }

      const delay = computeDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, jitter);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Poll a function until a predicate is satisfied or max attempts are exhausted.
 *
 * Uses configurable backoff between polls to reduce API pressure.
 *
 * @param fn - Async function to poll
 * @param predicate - Returns true when polling should stop
 * @param options - Poll configuration
 * @returns Object with the last result and whether the predicate was satisfied
 *
 * @example
 * ```ts
 * const { result, settled } = await pollUntil(
 *   () => broker.getOrder(orderId),
 *   (order) => order.status === 'filled',
 *   { maxAttempts: 20, initialIntervalMs: 500 },
 * );
 * if (!settled) console.warn('Order did not fill in time');
 * ```
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options?: PollOptions,
): Promise<{ result: T; settled: boolean }> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const initialIntervalMs = options?.initialIntervalMs ?? 500;
  const maxIntervalMs = options?.maxIntervalMs ?? 5_000;
  const backoffMultiplier = options?.backoffMultiplier ?? 1.5;

  let interval = initialIntervalMs;
  let lastResult: T | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await fn();

    if (predicate(lastResult)) {
      return { result: lastResult, settled: true };
    }

    // Don't wait after the last attempt
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      interval = Math.min(interval * backoffMultiplier, maxIntervalMs);
    }
  }

  return { result: lastResult as T, settled: false };
}
