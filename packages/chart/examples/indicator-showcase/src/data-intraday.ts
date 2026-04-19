/**
 * Synthetic intraday (1-hour bar) data generator.
 *
 * Produces 14 days × 24 hours = 336 hourly candles starting at a fixed
 * UTC midnight, so every ICT kill zone window (Asia / London Open /
 * NY Open / London Close) is represented multiple times.
 *
 * Uses a seeded PRNG so the dataset is stable between reloads.
 */

import type { NormalizedCandle } from "trendcraft";

const HOUR_MS = 60 * 60 * 1000;
const DAYS = 14;
const BARS_PER_DAY = 24;

/** Mulberry32 — tiny deterministic PRNG */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Start at 2026-03-01 00:00 UTC — a Sunday, so the 14-day span covers a full business cycle. */
const START_TIME_MS = Date.UTC(2026, 2, 1, 0, 0, 0);

export function generateIntradayCandles(): NormalizedCandle[] {
  const rng = makeRng(20260301);
  const out: NormalizedCandle[] = [];
  let price = 100;

  for (let d = 0; d < DAYS; d++) {
    for (let h = 0; h < BARS_PER_DAY; h++) {
      const time = START_TIME_MS + (d * BARS_PER_DAY + h) * HOUR_MS;

      // Volatility profile: wider moves during London Open (7-9) and NY Open (12-14)
      const baseVol = 0.25;
      const sessionVol =
        (h >= 7 && h < 9) || (h >= 12 && h < 14)
          ? 0.7
          : h >= 15 && h < 17
            ? 0.55
            : h >= 0 && h < 5
              ? 0.3
              : 0.2;
      const vol = baseVol + sessionVol;

      const drift = (rng() - 0.5) * vol;
      const open = price;
      const close = Math.max(1, open + drift + (rng() - 0.5) * 0.15);
      const wickUp = rng() * vol * 0.6;
      const wickDn = rng() * vol * 0.6;
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDn;

      // Volume: higher during NY open, Asian is quieter
      const volumeBase =
        h >= 12 && h < 14
          ? 1_500_000
          : h >= 7 && h < 9
            ? 1_200_000
            : h >= 15 && h < 17
              ? 900_000
              : h >= 0 && h < 5
                ? 400_000
                : 600_000;
      const volume = Math.round(volumeBase * (0.6 + rng() * 0.8));

      out.push({
        time,
        open: round3(open),
        high: round3(high),
        low: round3(low),
        close: round3(close),
        volume,
      });

      price = close;
    }
  }

  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
