/**
 * JSON output formatter for screening results
 */

import type { ScreeningSessionResult } from "../types";

/**
 * Format screening results as JSON
 *
 * @param sessionResult - Screening session result
 * @param options - Formatting options
 * @returns Formatted JSON string
 */
export function formatJson(
  sessionResult: ScreeningSessionResult,
  options: { showAll?: boolean; pretty?: boolean } = {},
): string {
  const { showAll = false, pretty = true } = options;

  // Filter results if not showing all
  const filteredResults = showAll
    ? sessionResult.results
    : sessionResult.results.filter((r) => r.entrySignal || r.exitSignal);

  // Remove candles from output to keep it concise
  const cleanResults = filteredResults.map((r) => {
    const { candles: _candles, ...rest } = r;
    return rest;
  });

  const output = {
    ...sessionResult,
    results: cleanResults,
  };

  return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
}
