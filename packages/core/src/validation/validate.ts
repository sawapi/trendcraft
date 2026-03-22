/**
 * Main validation orchestrator for candle data
 *
 * Runs all enabled validation checks and returns a unified result.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";
import { detectDuplicates, removeDuplicates } from "./duplicate-detection";
import { detectGaps } from "./gap-detection";
import { detectOhlcErrors, detectPriceSpikes, detectVolumeAnomalies } from "./outlier-detection";
import { detectSplitHints } from "./split-detection";
import { detectStaleData } from "./stale-detection";
import type {
  GapDetectionOptions,
  SpikeDetectionOptions,
  StaleDetectionOptions,
  ValidationFinding,
  ValidationOptions,
  ValidationResult,
  VolumeAnomalyOptions,
} from "./types";

/**
 * Validate candle data quality
 *
 * Runs all enabled detection checks (gaps, duplicates, OHLC errors,
 * price spikes, volume anomalies, stale data, split hints) and
 * returns a consolidated validation result.
 *
 * @param candles - Raw or normalized candle array
 * @param options - Validation options to control which checks are enabled
 * @returns Validation result with findings grouped by severity
 *
 * @example
 * ```ts
 * const result = validateCandles(candles, { gaps: true, duplicates: true });
 * if (!result.valid) {
 *   console.log("Errors:", result.errors);
 * }
 * ```
 */
export function validateCandles(
  candles: Candle[] | NormalizedCandle[],
  options?: ValidationOptions,
): ValidationResult {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const opts: ValidationOptions = options ?? {};
  const findings: ValidationFinding[] = [];

  // Duplicate detection (default: true)
  if (opts.duplicates !== false) {
    findings.push(...detectDuplicates(normalized));
  }

  // Gap detection (default: true)
  if (opts.gaps !== false) {
    const gapOpts: GapDetectionOptions | undefined =
      typeof opts.gaps === "object" ? opts.gaps : undefined;
    findings.push(...detectGaps(normalized, gapOpts));
  }

  // OHLC consistency (default: true)
  if (opts.ohlc !== false) {
    findings.push(...detectOhlcErrors(normalized));
  }

  // Price spikes (default: true)
  if (opts.spikes !== false) {
    const spikeOpts: SpikeDetectionOptions | undefined =
      typeof opts.spikes === "object" ? opts.spikes : undefined;
    findings.push(...detectPriceSpikes(normalized, spikeOpts));
  }

  // Volume anomalies (default: true)
  if (opts.volumeAnomalies !== false) {
    const volOpts: VolumeAnomalyOptions | undefined =
      typeof opts.volumeAnomalies === "object" ? opts.volumeAnomalies : undefined;
    findings.push(...detectVolumeAnomalies(normalized, volOpts));
  }

  // Stale data (default: true)
  if (opts.stale !== false) {
    const staleOpts: StaleDetectionOptions | undefined =
      typeof opts.stale === "object" ? opts.stale : undefined;
    findings.push(...detectStaleData(normalized, staleOpts));
  }

  // Split hints (default: false)
  if (opts.splits === true) {
    findings.push(...detectSplitHints(normalized));
  }

  // Categorize findings by severity
  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const info = findings.filter((f) => f.severity === "info");

  const result: ValidationResult = {
    valid: errors.length === 0,
    totalFindings: findings.length,
    errors,
    warnings,
    info,
  };

  // Auto-clean: remove duplicates and sort by time
  if (opts.autoClean) {
    const cleaned = removeDuplicates(normalized);
    cleaned.sort((a, b) => a.time - b.time);
    result.cleanedCandles = cleaned;
  }

  return result;
}
