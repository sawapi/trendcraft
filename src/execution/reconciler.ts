/**
 * Position Reconciliation
 *
 * Compares internal position state against external broker positions
 * to detect discrepancies. Broker-agnostic — works with any source
 * that can produce `PositionSnapshot` arrays.
 *
 * @example
 * ```ts
 * import { reconcilePositions } from "trendcraft/execution";
 *
 * const discrepancies = reconcilePositions(internalPositions, brokerPositions, {
 *   priceTolerance: 0.01,
 * });
 *
 * for (const d of discrepancies) {
 *   console.warn(d.message);
 * }
 * ```
 */

import type { Discrepancy, PositionSnapshot } from "./order-types";

/**
 * Options for position reconciliation
 */
export type ReconcileOptions = {
  /**
   * Maximum allowed relative difference between internal and external
   * average entry prices before flagging a price mismatch.
   * Expressed as a fraction (e.g., 0.01 = 1%). Default: 0.01
   */
  priceTolerance?: number;
};

/**
 * Compare internal positions against external (broker) positions and
 * return a list of discrepancies.
 *
 * @param internal - Positions tracked internally
 * @param external - Positions reported by the broker
 * @param options - Reconciliation options
 * @returns Array of discrepancies (empty if positions match)
 *
 * @example
 * ```ts
 * const internal: PositionSnapshot[] = [
 *   { symbol: "AAPL", quantity: 10, avgEntryPrice: 150 },
 * ];
 * const external: PositionSnapshot[] = [
 *   { symbol: "AAPL", quantity: 8, avgEntryPrice: 150.5 },
 *   { symbol: "TSLA", quantity: 5, avgEntryPrice: 200 },
 * ];
 *
 * const diffs = reconcilePositions(internal, external);
 * // [
 * //   { symbol: "AAPL", type: "quantity-mismatch", ... },
 * //   { symbol: "TSLA", type: "missing-internal", ... },
 * // ]
 * ```
 */
export function reconcilePositions(
  internal: PositionSnapshot[],
  external: PositionSnapshot[],
  options: ReconcileOptions = {},
): Discrepancy[] {
  const { priceTolerance = 0.01 } = options;
  const discrepancies: Discrepancy[] = [];

  const internalMap = new Map<string, PositionSnapshot>();
  for (const pos of internal) {
    internalMap.set(pos.symbol, pos);
  }

  const externalMap = new Map<string, PositionSnapshot>();
  for (const pos of external) {
    externalMap.set(pos.symbol, pos);
  }

  // Check all internal positions against external
  for (const [symbol, intPos] of internalMap) {
    const extPos = externalMap.get(symbol);

    if (!extPos) {
      discrepancies.push({
        symbol,
        type: "missing-external",
        internal: intPos,
        message: `Position ${symbol} exists internally (qty=${intPos.quantity}) but not at broker`,
      });
      continue;
    }

    if (intPos.quantity !== extPos.quantity) {
      discrepancies.push({
        symbol,
        type: "quantity-mismatch",
        internal: intPos,
        external: extPos,
        message: `Position ${symbol} quantity mismatch: internal=${intPos.quantity}, broker=${extPos.quantity}`,
      });
    }

    // Check price mismatch (relative difference)
    if (intPos.avgEntryPrice > 0 && extPos.avgEntryPrice > 0) {
      const priceDiff =
        Math.abs(intPos.avgEntryPrice - extPos.avgEntryPrice) / intPos.avgEntryPrice;
      if (priceDiff > priceTolerance) {
        discrepancies.push({
          symbol,
          type: "price-mismatch",
          internal: intPos,
          external: extPos,
          message: `Position ${symbol} avgEntryPrice mismatch: internal=${intPos.avgEntryPrice}, broker=${extPos.avgEntryPrice} (diff=${(priceDiff * 100).toFixed(2)}%)`,
        });
      }
    }
  }

  // Check for positions that exist externally but not internally
  for (const [symbol, extPos] of externalMap) {
    if (!internalMap.has(symbol)) {
      discrepancies.push({
        symbol,
        type: "missing-internal",
        external: extPos,
        message: `Position ${symbol} exists at broker (qty=${extPos.quantity}) but not tracked internally`,
      });
    }
  }

  return discrepancies;
}
