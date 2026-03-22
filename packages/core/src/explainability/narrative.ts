/**
 * Narrative generation for signal explainability
 *
 * Generates human-readable explanations of why a signal fired or didn't fire,
 * with support for English and Japanese output.
 */

import type { ConditionTrace } from "../types/explainability";

/**
 * Generate a human-readable narrative from a condition trace
 *
 * Walks the trace tree and builds a descriptive sentence for each leaf condition,
 * joining them with appropriate connectors for combined conditions.
 *
 * @param trace - Root condition trace
 * @param signalType - Whether this is an "entry" or "exit" signal
 * @param fired - Whether the signal actually fired
 * @param candle - Current candle data
 * @param language - Output language: "en" (default) or "ja"
 * @returns Human-readable narrative string
 *
 * @example
 * ```ts
 * import { generateNarrative } from "trendcraft";
 *
 * const narrative = generateNarrative(trace, "entry", true, candle);
 * // => "Entry signal fired. rsiBelow(30): passed (rsi14 = 28.5)."
 * ```
 */
export function generateNarrative(
  trace: ConditionTrace,
  signalType: "entry" | "exit",
  fired: boolean,
  candle: { open: number; high: number; low: number; close: number; volume: number },
  language: "en" | "ja" = "en",
): string {
  if (language === "ja") {
    return generateJaNarrative(trace, signalType, fired, candle);
  }
  return generateEnNarrative(trace, signalType, fired, candle);
}

/**
 * Generate English narrative
 */
function generateEnNarrative(
  trace: ConditionTrace,
  signalType: "entry" | "exit",
  fired: boolean,
  candle: { open: number; high: number; low: number; close: number; volume: number },
): string {
  const typeLabel = signalType === "entry" ? "Entry" : "Exit";
  const firedLabel = fired ? "fired" : "did not fire";
  const header = `${typeLabel} signal ${firedLabel} at close=${candle.close}.`;

  const details = buildEnDetails(trace);
  return `${header} ${details}`;
}

/**
 * Build English detail string from a trace tree
 */
function buildEnDetails(trace: ConditionTrace): string {
  // Leaf condition (preset, mtf-preset, function)
  if (!trace.children || trace.children.length === 0) {
    const status = trace.passed ? "passed" : "failed";
    const valuesStr = formatIndicatorValues(trace.indicatorValues);
    if (valuesStr) {
      return `${trace.name}: ${status} (${valuesStr}).`;
    }
    return `${trace.name}: ${status}.`;
  }

  // Combined condition
  const childDetails = trace.children.map((c) => buildEnDetails(c));

  if (trace.name.startsWith("not(")) {
    return `NOT [${childDetails[0]}]`;
  }

  const connector = trace.name.startsWith("and(") ? " AND " : " OR ";
  return childDetails.join(connector);
}

/**
 * Generate Japanese narrative
 */
function generateJaNarrative(
  trace: ConditionTrace,
  signalType: "entry" | "exit",
  fired: boolean,
  candle: { open: number; high: number; low: number; close: number; volume: number },
): string {
  const typeLabel = signalType === "entry" ? "エントリー" : "イグジット";
  const firedLabel = fired ? "発火しました" : "発火しませんでした";
  const header = `${typeLabel}シグナルは終値=${candle.close}で${firedLabel}。`;

  const details = buildJaDetails(trace);
  return `${header} ${details}`;
}

/**
 * Build Japanese detail string from a trace tree
 */
function buildJaDetails(trace: ConditionTrace): string {
  // Leaf condition
  if (!trace.children || trace.children.length === 0) {
    const status = trace.passed ? "成立" : "不成立";
    const valuesStr = formatIndicatorValues(trace.indicatorValues);
    if (valuesStr) {
      return `${trace.name}: ${status} (${valuesStr})`;
    }
    return `${trace.name}: ${status}`;
  }

  // Combined condition
  const childDetails = trace.children.map((c) => buildJaDetails(c));

  if (trace.name.startsWith("not(")) {
    return `NOT [${childDetails[0]}]`;
  }

  const connector = trace.name.startsWith("and(") ? "、かつ " : "、または ";
  return childDetails.join(connector);
}

/**
 * Format indicator values into a human-readable string
 *
 * @example
 * ```ts
 * formatIndicatorValues({ rsi14: 28.5, sma5: 102.3 })
 * // => "rsi14 = 28.5, sma5 = 102.3"
 * ```
 */
function formatIndicatorValues(values: Record<string, unknown>): string {
  const entries = Object.entries(values);
  if (entries.length === 0) return "";

  return entries
    .map(([key, value]) => {
      if (typeof value === "number") {
        return `${key} = ${Number(value.toFixed(4))}`;
      }
      if (typeof value === "object" && value !== null) {
        // For complex values (e.g., MACD), stringify compactly
        return `${key} = ${JSON.stringify(value)}`;
      }
      return `${key} = ${String(value)}`;
    })
    .join(", ");
}
