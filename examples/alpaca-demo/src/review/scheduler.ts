/**
 * Review Scheduler — automatically trigger daily reviews after market close
 *
 * Schedules a review at 16:05 ET (5 minutes after market close) each trading day.
 */

import { getEasternOffsetMs } from "../config/market-hours.js";
import { loadTodayReviews } from "./history.js";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const REVIEW_HOUR = 16;
const REVIEW_MINUTE = 5;

export type ScheduleReviewOptions = {
  onReview: () => Promise<void>;
  onError?: (err: unknown) => void;
};

/**
 * Schedule automatic daily review after market close.
 *
 * Returns a cleanup function to cancel the scheduled review.
 */
export function scheduleReview(opts: ScheduleReviewOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  function scheduleNext(): void {
    if (cancelled) return;

    const delayMs = getDelayUntilNextReview();
    console.log(`[SCHEDULER] Next review in ${(delayMs / MINUTE).toFixed(0)} minutes`);

    timer = setTimeout(async () => {
      if (cancelled) return;

      // Check if already reviewed today
      const todayReviews = loadTodayReviews();
      if (todayReviews.length > 0) {
        console.log("[SCHEDULER] Already reviewed today, skipping.");
        scheduleNext();
        return;
      }

      console.log("[SCHEDULER] Running scheduled daily review...");
      try {
        await opts.onReview();
      } catch (err) {
        console.error("[SCHEDULER] Review failed:", err);
        opts.onError?.(err);
      }

      // Schedule next review
      scheduleNext();
    }, delayMs);
  }

  scheduleNext();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Calculate milliseconds until the next 16:05 ET review time.
 * If it's already past 16:05 ET today, schedule for the next weekday.
 */
function getDelayUntilNextReview(): number {
  const now = new Date();
  const etOffsetMs = getEasternOffsetMs();

  // Convert current time to ET
  const utcMs = now.getTime();
  const etMs = utcMs + etOffsetMs + now.getTimezoneOffset() * MINUTE;
  const etDate = new Date(etMs);

  // Target time today: 16:05 ET
  const targetToday = new Date(etDate);
  targetToday.setHours(REVIEW_HOUR, REVIEW_MINUTE, 0, 0);

  let targetMs = targetToday.getTime() - etDate.getTime();

  // If past target time today, move to next day
  if (targetMs <= 0) {
    targetMs += 24 * HOUR;
  }

  // Skip weekends (Saturday = 6, Sunday = 0)
  const targetDate = new Date(etMs + targetMs);
  const day = targetDate.getDay();
  if (day === 0)
    targetMs += 24 * HOUR; // Sunday → Monday
  else if (day === 6) targetMs += 2 * 24 * HOUR; // Saturday → Monday

  return targetMs;
}
