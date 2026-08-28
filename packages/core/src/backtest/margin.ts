/** Margin/leverage configuration */
export type MarginConfig = {
  /** Leverage ratio (e.g., 2.0 = 2x leverage) */
  leverage: number;
  /** Maintenance margin ratio (e.g., 0.25 = 25%) */
  maintenanceMargin: number;
  /** Action on margin call */
  marginCallAction: "liquidate" | "reduceToMaintenance";
  /**
   * Annual interest rate on the borrowed amount (e.g. `0.05` = 5%).
   *
   * Charged as simple interest over the elapsed holding time: the annual rate
   * is divided by 365 and multiplied by the **fractional** days a position was
   * open. A one-hour trade pays one hour of interest.
   *
   * This is not the convention brokers bill on — they charge on the overnight
   * settled balance, so an intraday round trip accrues nothing at all.
   * Modelling that needs a day boundary: a timezone and a settlement cutoff,
   * since margin interest accrues on calendar days including weekends and
   * holidays. `BacktestOptions` takes neither today.
   */
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
 * For longs the position is an asset worth its market value. For shorts
 * the account's claim is what covering would return — the entry proceeds
 * plus unrealized P&L (`entryValue + (entryValue - positionValue)`), with
 * `positionValue` being the current cover cost. The margin ratio divides
 * by `positionValue` in both cases (market exposure).
 *
 * @param state - Current margin state
 * @param positionValue - Current market value of the position (cover cost for shorts)
 * @param capital - Remaining cash not deployed in the position
 * @param direction - Position direction (default: "long")
 * @param entryValue - Entry notional (entry price × shares); required for shorts
 * @returns Updated margin state
 *
 * @example
 * ```ts
 * let state = createMarginState(10000, 2.0);
 * // Bought $20000 worth at 2x (cash 0 left), now position is worth $18000
 * state = updateMarginState(state, 18000, 0);
 * // state.equity === 0 + 18000 - 10000 - 0 = 8000
 * // state.marginRatio === 8000 / 18000 ≈ 0.44
 * ```
 */
/**
 * Mark-to-market account equity: `cash + position claim − loan − interest`.
 *
 * The position claim is direction-signed — a long's claim is its market value,
 * a short's is the entry proceeds plus unrealized P&L
 * (`entryValue + (entryValue − positionValue)`), with `positionValue` the
 * current cover cost. This is the single definition shared by
 * {@link updateMarginState} (margin-call accounting) and the per-bar equity
 * curve emitted by `runBacktest`, so the two never drift.
 *
 * @param positionValue - Current market value of the position (cover cost for shorts)
 * @param capital - Cash not deployed in the position
 * @param direction - Position direction (default: "long")
 * @param entryValue - Entry notional (entry price × shares); required for shorts
 * @param borrowedAmount - Outstanding margin loan (default 0)
 * @param accumulatedInterest - Accrued, unsettled margin interest (default 0)
 * @returns Mark-to-market account equity
 */
export function accountEquity(
  positionValue: number,
  capital: number,
  direction: "long" | "short" = "long",
  entryValue: number = positionValue,
  borrowedAmount = 0,
  accumulatedInterest = 0,
): number {
  const positionClaim =
    direction === "short" ? entryValue + (entryValue - positionValue) : positionValue;
  return capital + positionClaim - borrowedAmount - accumulatedInterest;
}

export function updateMarginState(
  state: MarginState,
  positionValue: number,
  capital: number,
  direction: "long" | "short" = "long",
  entryValue: number = positionValue,
): MarginState {
  const equity = accountEquity(
    positionValue,
    capital,
    direction,
    entryValue,
    state.borrowedAmount,
    state.accumulatedInterest,
  );
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
 * @param days - Days to accrue over. Fractional: a six-hour hold is `0.25`
 * @returns Interest amount for the period
 *
 * @example
 * ```ts
 * const state = createMarginState(10000, 2.0);
 * // 5% annual rate → daily rate = 0.05 / 365
 * const interest = accrueInterest(state, 0.05 / 365, 1);
 * // interest ≈ 10000 * 0.000137 * 1 ≈ 1.37
 *
 * // Six hours of the same loan
 * const partial = accrueInterest(state, 0.05 / 365, 6 / 24);
 * // partial ≈ 0.34
 * ```
 */
export function accrueInterest(state: MarginState, dailyRate: number, days: number): number {
  return state.borrowedAmount * dailyRate * days;
}

/**
 * Repay the borrowed principal for the fraction of a position being closed.
 *
 * Exit proceeds include the loan-funded notional, so the loan must leave
 * the account as the position that borrowed it unwinds — otherwise
 * leveraged backtests overstate final capital by roughly the borrowed
 * amount. Mutates `state.borrowedAmount` and returns the repaid amount for
 * the caller to subtract from the close proceeds.
 *
 * Settle interest (which accrues on the outstanding `borrowedAmount`)
 * BEFORE calling this on a full close, since repayment zeroes the balance.
 *
 * @param state - Current margin state (mutated)
 * @param fraction - Fraction of the position being closed (clamped to [0, 1])
 * @returns Repaid principal amount
 */
export function repayLoan(state: MarginState, fraction: number): number {
  if (state.borrowedAmount <= 0) return 0;
  const repaid = state.borrowedAmount * Math.min(1, Math.max(0, fraction));
  state.borrowedAmount -= repaid;
  return repaid;
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
 * // state.marginRatio = (10000 + 11000 - 10000) / 11000 = 1.0
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
