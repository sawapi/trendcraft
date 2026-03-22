import type { CommonDateRange, NormalizedCandle, SymbolSession } from "../types";

/**
 * Calculate common date range across multiple symbols
 */
export function calculateCommonDateRange(symbols: SymbolSession[]): CommonDateRange | null {
  if (symbols.length === 0) return null;

  if (symbols.length === 1) {
    const dates = symbols[0].allCandles.map((c) => c.time);
    return {
      startDate: Math.min(...dates),
      endDate: Math.max(...dates),
      dates: dates.sort((a, b) => a - b),
    };
  }

  const allDateSets = symbols.map((s) => new Set(s.allCandles.map((c) => c.time)));
  const firstDates = [...allDateSets[0]];
  const commonDates = firstDates.filter((d) => allDateSets.every((set) => set.has(d)));

  if (commonDates.length === 0) return null;

  const sortedDates = commonDates.sort((a, b) => a - b);
  return {
    startDate: Math.min(...sortedDates),
    endDate: Math.max(...sortedDates),
    dates: sortedDates,
  };
}

/**
 * Get a symbol's candle index for a given global date
 */
export function getSymbolCurrentIndex(symbol: SymbolSession, globalDate: number): number {
  return symbol.allCandles.findIndex((c) => c.time === globalDate);
}

/**
 * Generate a UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get the active symbol from state
 */
export function getActiveSymbolFromState(
  symbols: SymbolSession[],
  activeSymbolId: string | null,
): SymbolSession | null {
  if (!activeSymbolId) return symbols[0] || null;
  return symbols.find((s) => s.id === activeSymbolId) || null;
}

/**
 * Get the active symbol's current candle index
 */
export function getActiveCurrentIndex(
  symbols: SymbolSession[],
  activeSymbolId: string | null,
  commonDateRange: CommonDateRange | null,
  currentDateIndex: number,
): number {
  const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
  if (!symbol || !commonDateRange) return 0;

  const targetDate = commonDateRange.dates[currentDateIndex];
  if (!targetDate) return 0;

  return symbol.allCandles.findIndex((c) => c.time === targetDate);
}

/**
 * Get visible candles from start to current index
 */
export function getVisibleCandlesFromSymbol(
  symbol: SymbolSession,
  globalDate: number,
): NormalizedCandle[] {
  const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
  return symbol.allCandles.slice(symbol.startIndex, currentIdx + 1);
}
