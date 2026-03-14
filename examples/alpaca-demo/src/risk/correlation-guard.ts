/**
 * Sector Correlation Guard — prevents concentration in a single sector
 *
 * Uses SEC universe sector mapping to limit the number of open positions
 * within the same sector.
 */

import { loadSecUniverse } from "../sec/index.js";
import type { SectorId } from "../sec/types.js";

export type CorrelationCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check whether a new position for `symbol` would violate sector concentration limits.
 *
 * @example
 * ```ts
 * const result = checkSectorExposure("MSFT", openPositions, sectorMap, 2);
 * if (!result.allowed) console.log(result.reason);
 * ```
 */
export function checkSectorExposure(
  symbol: string,
  openPositions: { symbol: string }[],
  sectorMap: Map<string, SectorId>,
  maxPerSector: number,
): CorrelationCheckResult {
  const sector = sectorMap.get(symbol);
  if (!sector || sector === "other") {
    // Unknown sector — allow (no data to enforce)
    return { allowed: true };
  }

  let sectorCount = 0;
  for (const pos of openPositions) {
    if (sectorMap.get(pos.symbol) === sector) {
      sectorCount++;
    }
  }

  if (sectorCount >= maxPerSector) {
    return {
      allowed: false,
      reason: `Sector "${sector}" already has ${sectorCount}/${maxPerSector} positions`,
    };
  }

  return { allowed: true };
}

/**
 * Build a symbol → sector map from the SEC universe cache.
 * Falls back to an empty map if the cache is not available.
 */
export function buildSectorMap(): Map<string, SectorId> {
  const map = new Map<string, SectorId>();

  try {
    const data = loadSecUniverse();
    if (data) {
      for (const entry of data.entries) {
        if (entry.sector) {
          map.set(entry.ticker, entry.sector);
        }
      }
    }
  } catch {
    // SEC cache not available — return empty map
  }

  return map;
}
