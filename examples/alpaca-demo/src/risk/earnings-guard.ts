/**
 * Earnings Guard — blocks entries near earnings announcements
 *
 * Uses a simple in-memory cache of known earnings dates.
 * Sources: Alpaca corporate actions API or manual configuration.
 */

export type EarningsEntry = {
  symbol: string;
  /** Earnings date (YYYY-MM-DD) */
  date: string;
};

export type EarningsGuardOptions = {
  /** Days before earnings to block entries (default: 2) */
  bufferDays?: number;
  /** Days after earnings to block entries (default: 1) */
  bufferDaysAfter?: number;
};

export type EarningsGuard = {
  /** Check if a symbol has upcoming earnings within the buffer window */
  hasUpcomingEarnings(symbol: string): boolean;
  /** Add earnings dates to the guard */
  addEarnings(entries: EarningsEntry[]): void;
  /** Get the next earnings date for a symbol (if known) */
  getNextEarnings(symbol: string): string | null;
};

const MS_PER_DAY = 86400000;

/**
 * Create an earnings guard that blocks entries near earnings dates.
 *
 * @example
 * ```ts
 * const guard = createEarningsGuard({ bufferDays: 2 });
 * guard.addEarnings([{ symbol: "AAPL", date: "2026-03-20" }]);
 * if (guard.hasUpcomingEarnings("AAPL")) {
 *   console.log("Blocked: earnings approaching");
 * }
 * ```
 */
export function createEarningsGuard(opts: EarningsGuardOptions = {}): EarningsGuard {
  const bufferDays = opts.bufferDays ?? 2;
  const bufferDaysAfter = opts.bufferDaysAfter ?? 1;
  // symbol -> sorted array of earnings dates (ms timestamps)
  const earningsMap = new Map<string, number[]>();

  function addEntries(entries: EarningsEntry[]): void {
    for (const entry of entries) {
      const ts = new Date(entry.date).getTime();
      if (Number.isNaN(ts)) continue;

      const existing = earningsMap.get(entry.symbol) ?? [];
      existing.push(ts);
      existing.sort((a, b) => a - b);
      earningsMap.set(entry.symbol, existing);
    }
  }

  return {
    hasUpcomingEarnings(symbol: string): boolean {
      const dates = earningsMap.get(symbol);
      if (!dates || dates.length === 0) return false;

      const now = Date.now();
      const windowStart = now - bufferDaysAfter * MS_PER_DAY;
      const windowEnd = now + bufferDays * MS_PER_DAY;

      return dates.some((d) => d >= windowStart && d <= windowEnd);
    },

    addEarnings(entries: EarningsEntry[]): void {
      addEntries(entries);
    },

    getNextEarnings(symbol: string): string | null {
      const dates = earningsMap.get(symbol);
      if (!dates) return null;

      const now = Date.now();
      const next = dates.find((d) => d >= now);
      if (!next) return null;
      return new Date(next).toISOString().split("T")[0];
    },
  };
}

/**
 * Fetch earnings calendar from Alpaca corporate actions API.
 * Returns earnings entries for the specified symbols.
 */
export async function fetchEarningsCalendar(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  symbols: string[],
): Promise<EarningsEntry[]> {
  const entries: EarningsEntry[] = [];

  // Alpaca corporate actions API: GET /v1/corporate-actions/announcements
  const now = new Date();
  const start = now.toISOString().split("T")[0];
  const end = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString().split("T")[0];

  try {
    const url = new URL("/v1/corporate-actions/announcements", baseUrl);
    url.searchParams.set("ca_types", "Dividend"); // Earnings announcements come with dividends
    url.searchParams.set("since", start);
    url.searchParams.set("until", end);

    const response = await fetch(url.toString(), {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as Array<{
        corporate_actions_type: string;
        symbol: string;
        declaration_date?: string;
        ex_date?: string;
        record_date?: string;
      }>;

      const symbolSet = new Set(symbols);
      for (const action of data) {
        if (symbolSet.has(action.symbol) && action.record_date) {
          entries.push({
            symbol: action.symbol,
            date: action.record_date,
          });
        }
      }
    }
  } catch {
    // API call failed — earnings data unavailable
  }

  return entries;
}
