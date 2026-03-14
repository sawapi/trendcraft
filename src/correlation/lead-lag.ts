import type { CorrelationAnalysisOptions, LeadLagResult } from "../types/correlation";
import { pearsonCorrelation } from "./rolling";

/**
 * Analyze lead-lag relationship between two series using cross-correlation
 *
 * Tests correlations at various lags to determine if one asset leads
 * the other. A positive optimal lag means A leads B; negative means B leads A.
 *
 * @param returnsA - Returns for asset A
 * @param returnsB - Returns for asset B
 * @param options - Analysis options (maxLag)
 * @returns Lead-lag analysis result with optimal lag and assessment
 *
 * @example
 * ```ts
 * const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
 * console.log(`Optimal lag: ${result.optimalLag}`);
 * // Positive lag = A leads B, Negative = B leads A
 * ```
 */
export function analyzeLeadLag(
  returnsA: number[],
  returnsB: number[],
  options: CorrelationAnalysisOptions = {},
): LeadLagResult {
  const maxLag = options.maxLag ?? 10;
  const n = Math.min(returnsA.length, returnsB.length);

  const crossCorrelation: Array<{ lag: number; correlation: number }> = [];
  let maxAbsCorr = 0;
  let optimalLag = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let a: number[];
    let b: number[];

    if (lag >= 0) {
      // A leads: compare A[0..n-lag] with B[lag..n]
      a = returnsA.slice(0, n - lag);
      b = returnsB.slice(lag, n);
    } else {
      // B leads: compare A[-lag..n] with B[0..n+lag]
      a = returnsA.slice(-lag, n);
      b = returnsB.slice(0, n + lag);
    }

    if (a.length < 5) continue;

    const corr = pearsonCorrelation(a, b);
    crossCorrelation.push({ lag, correlation: corr });

    if (Math.abs(corr) > maxAbsCorr) {
      maxAbsCorr = Math.abs(corr);
      optimalLag = lag;
    }
  }

  let assessment: string;
  if (Math.abs(maxAbsCorr) < 0.2) {
    assessment = "No significant lead-lag relationship detected.";
  } else if (optimalLag > 0) {
    assessment = `Asset A leads Asset B by ${optimalLag} bar(s) (correlation: ${maxAbsCorr.toFixed(3)}).`;
  } else if (optimalLag < 0) {
    assessment = `Asset B leads Asset A by ${-optimalLag} bar(s) (correlation: ${maxAbsCorr.toFixed(3)}).`;
  } else {
    assessment = `Assets are contemporaneously correlated (correlation: ${maxAbsCorr.toFixed(3)}).`;
  }

  return { optimalLag, crossCorrelation, maxCorrelation: maxAbsCorr, assessment };
}
