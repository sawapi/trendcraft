/**
 * Metric display and scaling that survive `Infinity`. TrendCraft reports a
 * profit factor with no losing trade as `Infinity`, and that flows into
 * optimization scores and sensitivity means when the metric is profitFactor.
 */

/** `value.toFixed(digits)`, with ±Infinity as "∞" / "-∞" and NaN as "—". */
export function formatMetric(value: number, digits: number): string {
  if (value === Number.POSITIVE_INFINITY) return "∞";
  if (value === Number.NEGATIVE_INFINITY) return "-∞";
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/**
 * Map values onto [0, 1] by their finite range: +Infinity sits at 1 (level
 * with the finite maximum, not above it), -Infinity at 0. Scaling by a
 * range that includes Infinity would make every finite value 0 and the
 * infinite one NaN.
 */
export function metricScaler(values: number[]): (value: number) => number {
  const finite = values.filter(Number.isFinite);
  const min = finite.length > 0 ? Math.min(...finite) : 0;
  const max = finite.length > 0 ? Math.max(...finite) : 0;
  const span = max - min || 1;
  return (value) => {
    if (value === Number.POSITIVE_INFINITY) return 1;
    if (value === Number.NEGATIVE_INFINITY) return 0;
    return (value - min) / span;
  };
}
