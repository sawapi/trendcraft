/**
 * useSymbolSource — load symbols from SEC universe + static universes
 *
 * Provides filtered symbol lists by source (mega30, sp100, sec) and
 * optional sector/industry filters for the SEC universe.
 */

import { useEffect, useMemo, useState } from "react";
import { UNIVERSES } from "../../config/universe.js";
import { getAllSectors, getSectorName } from "../../sec/sic-sectors.js";
import type { IndustryId, SecUniverseEntry, SectorId } from "../../sec/types.js";
import { loadSecUniverse } from "../../sec/universe-builder.js";

export type SymbolSourceId = "mega30" | "sp100" | "sec";

export const SYMBOL_SOURCES: { id: SymbolSourceId; label: string }[] = [
  { id: "mega30", label: "Mega 30" },
  { id: "sp100", label: "S&P 100" },
  { id: "sec", label: "SEC Universe" },
];

export type SymbolSourceState = {
  /** Current source */
  source: SymbolSourceId;
  /** Current sector filter (SEC only) */
  sector: SectorId | null;
  /** Available sectors (from SEC universe) */
  sectors: { id: SectorId; label: string; count: number }[];
  /** Filtered symbol list for the current source + sector */
  symbols: string[];
  /** Whether SEC universe is available */
  hasSecUniverse: boolean;
};

export type SymbolSourceActions = {
  setSource: (source: SymbolSourceId) => void;
  setSector: (sector: SectorId | null) => void;
  nextSource: () => void;
  nextSector: () => void;
  prevSector: () => void;
};

export function useSymbolSource(): [SymbolSourceState, SymbolSourceActions] {
  const [source, setSource] = useState<SymbolSourceId>("mega30");
  const [sector, setSector] = useState<SectorId | null>(null);
  const [secEntries, setSecEntries] = useState<SecUniverseEntry[]>([]);
  const [hasSecUniverse, setHasSecUniverse] = useState(false);

  // Load SEC universe on mount
  useEffect(() => {
    const data = loadSecUniverse();
    if (data) {
      setSecEntries(data.entries);
      setHasSecUniverse(true);
    }
  }, []);

  // Build sector list with counts
  const sectors = useMemo(() => {
    const counts = new Map<SectorId, number>();
    for (const entry of secEntries) {
      if (entry.sector) {
        counts.set(entry.sector, (counts.get(entry.sector) ?? 0) + 1);
      }
    }
    return getAllSectors()
      .filter((id) => (counts.get(id) ?? 0) > 0)
      .map((id) => ({
        id,
        label: getSectorName(id),
        count: counts.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [secEntries]);

  // Compute filtered symbols
  const symbols = useMemo(() => {
    if (source === "mega30") return [...UNIVERSES.mega30];
    if (source === "sp100") return [...UNIVERSES.sp100];

    // SEC universe with optional sector filter
    let filtered = secEntries;
    if (sector) {
      filtered = filtered.filter((e) => e.sector === sector);
    }
    return filtered.map((e) => e.ticker);
  }, [source, sector, secEntries]);

  const nextSource = () => {
    setSource((prev) => {
      const idx = SYMBOL_SOURCES.findIndex((s) => s.id === prev);
      const next = SYMBOL_SOURCES[(idx + 1) % SYMBOL_SOURCES.length];
      if (next.id === "sec" && !hasSecUniverse) {
        // Skip SEC if not available
        return SYMBOL_SOURCES[(idx + 2) % SYMBOL_SOURCES.length].id;
      }
      return next.id;
    });
    setSector(null);
  };

  const nextSector = () => {
    if (source !== "sec" || sectors.length === 0) return;
    setSector((prev) => {
      if (prev === null) return sectors[0].id;
      const idx = sectors.findIndex((s) => s.id === prev);
      if (idx >= sectors.length - 1) return null; // wrap to "All"
      return sectors[idx + 1].id;
    });
  };

  const prevSector = () => {
    if (source !== "sec" || sectors.length === 0) return;
    setSector((prev) => {
      if (prev === null) return sectors[sectors.length - 1].id;
      const idx = sectors.findIndex((s) => s.id === prev);
      if (idx <= 0) return null; // wrap to "All"
      return sectors[idx - 1].id;
    });
  };

  return [
    { source, sector, sectors, symbols, hasSecUniverse },
    { setSource, setSector, nextSource, nextSector, prevSector },
  ];
}
