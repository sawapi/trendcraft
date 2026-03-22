/**
 * Shared types for resilient order execution utilities
 */

/**
 * Options for exponential backoff retry
 *
 * @example
 * ```ts
 * const options: RetryOptions = {
 *   maxAttempts: 3,
 *   initialDelayMs: 500,
 *   maxDelayMs: 10_000,
 *   backoffMultiplier: 2,
 *   jitter: true,
 * };
 * ```
 */
export type RetryOptions = {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Initial delay between retries in ms. Default: 500 */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms. Default: 10_000 */
  maxDelayMs?: number;
  /** Multiplier applied to delay after each retry. Default: 2 */
  backoffMultiplier?: number;
  /** Add random jitter to delay to avoid thundering herd. Default: true */
  jitter?: boolean;
  /** Predicate to determine if an error is retryable. Default: all errors */
  retryableErrors?: (err: unknown) => boolean;
};

/**
 * Options for poll-until-settled loop
 *
 * @example
 * ```ts
 * const options: PollOptions = {
 *   maxAttempts: 20,
 *   initialIntervalMs: 500,
 *   maxIntervalMs: 5_000,
 *   backoffMultiplier: 1.5,
 * };
 * ```
 */
export type PollOptions = {
  /** Maximum polling attempts. Default: 20 */
  maxAttempts?: number;
  /** Initial polling interval in ms. Default: 500 */
  initialIntervalMs?: number;
  /** Maximum polling interval in ms. Default: 5_000 */
  maxIntervalMs?: number;
  /** Multiplier applied to interval after each poll. Default: 1.5 */
  backoffMultiplier?: number;
};
