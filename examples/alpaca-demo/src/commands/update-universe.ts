/**
 * CLI command: update-universe
 *
 * Build or refresh the SEC EDGAR universe cache with SIC sector mapping.
 */

import { loadEnv } from "../config/env.js";
import {
  buildSecUniverse,
  getAllIndustries,
  getAllSectors,
  getIndustryName,
  getSectorName,
} from "../sec/index.js";
import type { IndustryId, SectorId } from "../sec/index.js";

export type UpdateUniverseOptions = {
  force?: boolean;
  noAlpacaFilter?: boolean;
};

export async function updateUniverseCommand(opts: UpdateUniverseOptions): Promise<void> {
  const startMs = Date.now();

  // Load Alpaca env (needed for tradable filter unless --no-alpaca-filter)
  let env = null;
  if (!opts.noAlpacaFilter) {
    try {
      env = loadEnv();
    } catch {
      console.warn("Alpaca credentials not found. Running without tradable filter.");
    }
  }

  // Build universe
  const result = await buildSecUniverse(env, {
    force: opts.force,
    noAlpacaFilter: opts.noAlpacaFilter,
    onProgress(done, total) {
      if (done % 200 === 0 || done === total) {
        const pct = ((done / total) * 100).toFixed(1);
        process.stdout.write(`\r  Fetching SIC codes... ${done}/${total} (${pct}%)`);
      }
    },
  });

  // Clear progress line
  process.stdout.write(`\r${" ".repeat(60)}\r`);

  // Print sector summary
  const sectorCounts = new Map<SectorId | "null", number>();
  for (const e of result.entries) {
    const key = e.sector ?? "null";
    sectorCounts.set(key, (sectorCounts.get(key) ?? 0) + 1);
  }

  console.log("\nSector breakdown:");
  for (const sector of getAllSectors()) {
    const count = sectorCounts.get(sector) ?? 0;
    if (count > 0) {
      console.log(`  ${getSectorName(sector).padEnd(16)} ${String(count).padStart(5)}`);
    }
  }
  const nullCount = sectorCounts.get("null") ?? 0;
  if (nullCount > 0) {
    console.log(`  ${"(no SIC)".padEnd(16)} ${String(nullCount).padStart(5)}`);
  }

  // Print industry summary (top 15 by count)
  const industryCounts = new Map<IndustryId | "null", number>();
  for (const e of result.entries) {
    const key = e.industry ?? "null";
    industryCounts.set(key, (industryCounts.get(key) ?? 0) + 1);
  }

  const sortedIndustries = getAllIndustries()
    .map((id) => ({ id, count: industryCounts.get(id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  console.log("\nTop industries:");
  for (const { id, count } of sortedIndustries.slice(0, 15)) {
    console.log(`  ${getIndustryName(id).padEnd(22)} ${String(count).padStart(5)}`);
  }
  if (sortedIndustries.length > 15) {
    console.log(`  ... and ${sortedIndustries.length - 15} more`);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\nTotal: ${result.entries.length} symbols in ${elapsedSec}s`);
  console.log("Cache saved to data/sec-universe.json");
}
