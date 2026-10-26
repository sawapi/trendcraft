/**
 * Metric display that survives `Infinity`. TrendCraft reports a profit
 * factor with no losing trade as `Infinity`, and that flows into optimization
 * scores and sensitivity means when the metric is profitFactor.
 */

/** `value.toFixed(digits)`, with ±Infinity as "∞" / "-∞" and NaN as "—". */
export function formatMetric(value: number, digits: number): string {
  if (value === Number.POSITIVE_INFINITY) return "∞";
  if (value === Number.NEGATIVE_INFINITY) return "-∞";
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/** Profit factor as display text, to 2 decimals. */
export function formatProfitFactor(pf: number): string {
  return formatMetric(pf, 2);
}

/**
 * A plottable stand-in for each value: ±Infinity is drawn at the finite
 * maximum / minimum (level with it, not above), since a chart axis or color
 * scale cannot extend to Infinity. With no finite value at all, +Infinity is
 * drawn at 1 and -Infinity at 0, so an all-Infinity row does not read as a
 * score of 0. Show the real value with `formatMetric` in labels and tooltips.
 */
export function finitePlotter(values: number[]): (value: number) => number {
  const finite = values.filter(Number.isFinite);
  const min = finite.length > 0 ? Math.min(...finite) : 0;
  const max = finite.length > 0 ? Math.max(...finite) : 1;
  return (value) => {
    if (value === Number.POSITIVE_INFINITY) return max;
    if (value === Number.NEGATIVE_INFINITY) return min;
    return value;
  };
}
