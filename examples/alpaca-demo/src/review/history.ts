/**
 * Review History — persist and load daily review records
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { atomicWriteJson } from "../persistence/atomic-write.js";
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
  atomicWriteJson(path, record);
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
      } catch (err) {
        console.warn(`[history] Skipping corrupted review file ${file}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn("[history] Failed to read reviews directory:", err instanceof Error ? err.message : err);
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
