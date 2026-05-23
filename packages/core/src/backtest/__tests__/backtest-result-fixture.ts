/**
 * Shared spread-in fixture for the extended `BacktestResult` fields
 * added in this release. Test files that build mock results inline use
 * this so the type stays satisfied without each fixture duplicating
 * eleven zero-valued lines.
 */

export const EMPTY_EXTENDED_METRICS_FIXTURE = {
  sortinoRatio: 0,
  calmarRatio: 0,
  cagrPercent: 0,
  expectancyPercent: 0,
  exposurePercent: 0,
  avgWinPercent: 0,
  avgLossPercent: 0,
  largestWinPercent: 0,
  largestLossPercent: 0,
  firstBarTime: 0,
  lastBarTime: 0,
} as const;
