/**
 * Review History — persist and load daily review records
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import type { ReviewRecord } from "./types.js";

const REVIEWS_DIR = resolve(import.meta.dirname, "../../data/reviews");

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * Save a review record for a given date
 */
export function saveReviewRecord(record: ReviewRecord): string {
  ensureDir(REVIEWS_DIR);
  const path = resolve(REVIEWS_DIR, `${record.date}-review.json`);
  writeFileSync(path, JSON.stringify(record, null, 2), "utf-8");
  return path;
}

/**
 * Load review record for a specific date
 */
export function loadReviewRecord(date: string): ReviewRecord | null {
  const path = resolve(REVIEWS_DIR, `${date}-review.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ReviewRecord;
  } catch {
    return null;
  }
}

/**
 * Load recent review records (last N days)
 */
export function loadRecentReviews(days = 7): ReviewRecord[] {
  ensureDir(REVIEWS_DIR);
  const results: ReviewRecord[] = [];

  try {
    const files = readdirSync(REVIEWS_DIR)
      .filter((f) => f.endsWith("-review.json"))
      .sort()
      .slice(-days);

    for (const file of files) {
      try {
        const data = JSON.parse(
          readFileSync(resolve(REVIEWS_DIR, file), "utf-8"),
        ) as ReviewRecord;
        results.push(data);
      } catch {
        // Skip corrupted files
      }
    }
  } catch {
    // Dir may not exist
  }

  return results;
}

/**
 * Load today's reviews (for rate limiting)
 */
export function loadTodayReviews(): ReviewRecord[] {
  const today = new Date().toISOString().split("T")[0];
  const record = loadReviewRecord(today);
  return record ? [record] : [];
}
