/**
 * Strategy DNA — viewer-side glue.
 *
 * Re-exports the post-optimization analytics that now live in core
 * (`buildGenomeSegments`, `extractSensitivityData`,
 * `computeRecommendedParams`, `computeDnaGrade`) plus the
 * viewer-only URL codec for sharing strategies via the address bar.
 *
 * Names are aliased back to the viewer's prior local exports
 * (`Grade`, `RobustnessGrade`, `computeRobustnessGrade`) so the
 * UI components don't need to change imports.
 */

import type { DnaGrade, DnaGradeItem, DnaGradeReport } from "trendcraft";
import { computeDnaGrade } from "trendcraft";
import type { BacktestConfig } from "../types/chart";

// ── Core re-exports ────────────────────────────────────────────────

export type {
  GenomeSegment,
  RecommendedParams,
  SafeZone,
  SensitivityData,
  SensitivityPair,
  SensitivitySingle,
} from "trendcraft";
export {
  buildGenomeSegments,
  computeRecommendedParams,
  extractSensitivityData,
} from "trendcraft";

// Aliases preserving the viewer's prior local names.
export type Grade = DnaGrade;
export type GradeItem = DnaGradeItem;
export type RobustnessGrade = DnaGradeReport;
export const computeRobustnessGrade = computeDnaGrade;

// ── Share URL ──────────────────────────────────────────────────────
//
// URL encoding stays viewer-side: `BacktestConfig` is a viewer-local
// shape and the short-key map is shared only between this codec and
// the address-bar consumers. Lifting to core would force every other
// app to know about Studio/echarts-specific config field names.

const KEY_MAP: Record<string, string> = {
  entryCondition: "e",
  exitCondition: "x",
  capital: "c",
  stopLoss: "sl",
  takeProfit: "tp",
  trailingStop: "ts",
  atrTrailMultiplier: "am",
  atrTrailPeriod: "ap",
  partialThreshold: "pt",
  partialSellPercent: "pp",
  startDate: "sd",
  commissionRate: "cr",
  taxRate: "tr",
};

const REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k]),
);

const NUMERIC_FIELDS = new Set([
  "capital",
  "stopLoss",
  "takeProfit",
  "trailingStop",
  "atrTrailMultiplier",
  "atrTrailPeriod",
  "partialThreshold",
  "partialSellPercent",
  "commissionRate",
  "taxRate",
]);

export function encodeBacktestConfig(config: BacktestConfig): string {
  const params = new URLSearchParams();
  for (const [key, shortKey] of Object.entries(KEY_MAP)) {
    const value = config[key as keyof BacktestConfig];
    if (value !== undefined && value !== null && value !== "") {
      params.set(shortKey, String(value));
    }
  }
  return params.toString();
}

export function decodeBacktestConfig(params: URLSearchParams): Partial<BacktestConfig> {
  const config: Record<string, unknown> = {};
  for (const [shortKey, value] of params.entries()) {
    const fullKey = REVERSE_KEY_MAP[shortKey];
    if (!fullKey) continue;
    if (NUMERIC_FIELDS.has(fullKey)) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        config[fullKey] = num;
      }
    } else {
      config[fullKey] = value;
    }
  }
  return config as Partial<BacktestConfig>;
}
