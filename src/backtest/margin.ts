/** Margin/leverage configuration */
export type MarginConfig = {
  /** Leverage ratio (e.g., 2.0 = 2x leverage) */
  leverage: number;
  /** Maintenance margin ratio (e.g., 0.25 = 25%) */
  maintenanceMargin: number;
  /** Action on margin call */
  marginCallAction: "liquidate" | "reduceToMaintenance";
  /** Annual interest rate on borrowed amount (e.g., 0.05 = 5%) */
  interestRate?: number;
};

/** Margin state tracked during backtest */
export type MarginState = {
  /** Current equity (capital - borrowed + unrealized P&L) */
  equity: number;
  /** Amount borrowed */
  borrowedAmount: number;
  /** Current margin ratio (equity / position value) */
  marginRatio: number;
  /** Whether margin call is triggered */
  isMarginCall: boolean;
  /** Accumulated interest cost */
  accumulatedInterest: number;
};

/**
 * Create initial margin state from capital and leverage.
 *
 * @param capital - Own capital (initial equity)
 * @param leverage - Leverage ratio (e.g., 2.0 = 2x)
 * @returns Initial margin state
 *
 * @example
 * ```ts
 * const state = createMarginState(10000, 2.0);
 * // state.equity === 10000
 * // state.borrowedAmount === 10000  (10000 * (2 - 1))
 * // state.marginRatio === 1.0
 * ```
 */
export function createMarginState(capital: number, leverage: number): MarginState {
  return {
    equity: capital,
    borrowedAmount: capital * (leverage - 1),
    marginRatio: 1.0,
    isMarginCall: false,
    accumulatedInterest: 0,
  };
}

/**
 * Calculate total buying power given capital and leverage.
 *
 * @param capital - Own capital
 * @param leverage - Leverage ratio
 * @returns Total buying power (capital * leverage)
 *
 * @example
 * ```ts
 * const power = calculateBuyingPower(10000, 3.0);
 * // power === 30000
 * ```
 */
export function calculateBuyingPower(capital: number, leverage: number): number {
  return capital * leverage;
}

/**
 * Update margin state based on current position value.
 *
 * Recalculates equity and margin ratio. The caller is responsible for
 * checking `isMarginCall` via {@link checkMarginCall} and setting it
 * on the returned state.
 *
 * @param state - Current margin state
 * @param positionValue - Current market value of the position
 * @param capital - Original capital (cost basis)
 * @returns Updated margin state
 *
 * @example
 * ```ts
 * let state = createMarginState(10000, 2.0);
 * // Bought $20000 worth, now position is worth $18000
 * state = updateMarginState(state, 18000, 10000);
 * // state.equity === 10000 + 18000 - 10000 - 0 = 18000
 * // state.marginRatio === 18000 / 18000 = 1.0
 * ```
 */
export function updateMarginState(
  state: MarginState,
  positionValue: number,
  capital: number,
): MarginState {
  const equity = capital + positionValue - state.borrowedAmount - state.accumulatedInterest;
  const marginRatio = positionValue > 0 ? equity / positionValue : 1.0;

  return {
    ...state,
    equity,
    marginRatio,
  };
}

/**
 * Calculate interest accrued on borrowed amount for a given period.
 *
 * @param state - Current margin state
 * @param dailyRate - Daily interest rate (annual rate / 365)
 * @param days - Number of days to accrue
 * @returns Interest amount for the period
 *
 * @example
 * ```ts
 * const state = createMarginState(10000, 2.0);
 * // 5% annual rate → daily rate = 0.05 / 365
 * const interest = accrueInterest(state, 0.05 / 365, 1);
 * // interest ≈ 10000 * 0.000137 * 1 ≈ 1.37
 * ```
 */
export function accrueInterest(state: MarginState, dailyRate: number, days: number): number {
  return state.borrowedAmount * dailyRate * days;
}

/**
 * Check whether current margin ratio triggers a margin call.
 *
 * @param state - Current margin state
 * @param maintenanceMargin - Maintenance margin ratio threshold (e.g., 0.25)
 * @returns `true` if margin ratio is below maintenance requirement
 *
 * @example
 * ```ts
 * let state = createMarginState(10000, 2.0);
 * state = updateMarginState(state, 12000, 10000);
 * // state.marginRatio = (10000 + 12000 - 10000) / 12000 = 1.0
 * checkMarginCall(state, 0.25); // false
 *
 * state = updateMarginState(state, 11000, 10000);
 * // state.marginRatio = (10000 + 11000 - 10000) / 11000 ≈ 0.909
 * checkMarginCall(state, 0.25); // false
 *
 * // After a large drop:
 * state = updateMarginState(state, 2500, 10000);
 * // state.marginRatio = (10000 + 2500 - 10000) / 2500 = 1.0
 * // With borrowedAmount=10000: equity = 10000+2500-10000 = 2500
 * // marginRatio = 2500/2500 = 1.0 → still false
 * ```
 */
export function checkMarginCall(state: MarginState, maintenanceMargin: number): boolean {
  return state.marginRatio < maintenanceMargin;
}
