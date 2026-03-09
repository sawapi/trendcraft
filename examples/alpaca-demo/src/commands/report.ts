/**
 * CLI command: report
 *
 * Generate trade CSV export and/or tax summary report.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createStateStore } from "../persistence/store.js";
import { calculateTaxSummary, formatTaxReport } from "../report/tax-summary.js";
import { exportTradesCsv } from "../report/trade-export.js";

export type ReportCommandOptions = {
  year?: string;
  format?: string;
  output?: string;
};

export async function reportCommand(opts: ReportCommandOptions): Promise<void> {
  const store = createStateStore();
  const state = store.load();

  if (!state) {
    console.log("No saved state found. Run 'live' first.");
    return;
  }

  const year = opts.year ? Number.parseInt(opts.year, 10) : new Date().getFullYear();
  const format = opts.format ?? "both";
  const outputDir = resolve(opts.output ?? resolve(import.meta.dirname, "../../data"));

  mkdirSync(outputDir, { recursive: true });

  if (format === "csv" || format === "both") {
    const csvPath = resolve(outputDir, `trades-${year}.csv`);
    const { path, count } = exportTradesCsv(state.agents, csvPath, { year });
    console.log(`Exported ${count} trades to ${path}`);
  }

  if (format === "tax" || format === "both") {
    const summary = calculateTaxSummary(state.agents, { year });
    console.log(formatTaxReport(summary));
  }
}
