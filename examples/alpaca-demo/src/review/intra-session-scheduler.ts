/**
 * Intra-Session Scheduler — periodic mid-session LLM reviews during market hours
 *
 * Runs reviews at configurable intervals (default: 30 min) only during
 * market hours (9:30 - 15:45 ET). Includes async lock to prevent overlapping reviews.
 */

import { getEasternOffsetMs } from "../config/market-hours.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;

// Market hours boundaries (ET)
const MARKET_OPEN_MS = 9 * HOUR + 30 * MINUTE; // 9:30 ET
const REVIEW_CUTOFF_MS = 15 * HOUR + 45 * MINUTE; // 15:45 ET (15 min before close)

export type IntraSessionSchedulerOptions = {
  /** Review interval in milliseconds (default: 30 min) */
  intervalMs?: number;
  /** Callback to execute the review */
  onReview: () => Promise<void>;
  /** Error handler */
  onError?: (err: unknown) => void;
};

/**
 * Check if current time is within market hours for intra-session review.
 * Returns true between 9:30 and 15:45 ET on weekdays.
 */
export function isMarketOpenForReview(): boolean {
  const now = new Date();

  // Skip weekends
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  // Convert to ET
  const etOffsetMs = getEasternOffsetMs();
  const utcMs = now.getTime();
  const etMs = utcMs + etOffsetMs + now.getTimezoneOffset() * MINUTE;
  const etDate = new Date(etMs);

  const timeOfDayMs =
    etDate.getHours() * HOUR + etDate.getMinutes() * MINUTE + etDate.getSeconds() * 1000;

  return timeOfDayMs >= MARKET_OPEN_MS && timeOfDayMs <= REVIEW_CUTOFF_MS;
}

/**
 * Schedule periodic intra-session reviews during market hours.
 *
 * Returns a cancel function to stop the scheduler (call on shutdown).
 */
export function scheduleIntraSessionReview(opts: IntraSessionSchedulerOptions): () => void {
  const intervalMs = opts.intervalMs ?? 30 * MINUTE;
  let timer: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;
  let reviewInProgress = false;

  async function tick(): Promise<void> {
    if (cancelled) return;

    // Skip if not market hours
    if (!isMarketOpenForReview()) {
      return;
    }

    // Async lock: skip if previous review is still running
    if (reviewInProgress) {
      console.log("[INTRA] Review still in progress, skipping this interval.");
      return;
    }

    reviewInProgress = true;
    try {
      await opts.onReview();
    } catch (err) {
      console.error("[INTRA] Review error:", err);
      opts.onError?.(err);
    } finally {
      reviewInProgress = false;
    }
  }

  // Start interval
  timer = setInterval(tick, intervalMs);
  console.log(
    `[INTRA] Scheduler started (interval: ${intervalMs / MINUTE}min, hours: 9:30-15:45 ET)`,
  );

  return () => {
    cancelled = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
