import { assertOneOf, assertPositionDirection, keywords } from "../utils/validate-keyword";

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
   * This is not how brokers bill: they charge on the settled balance, so an
   * intraday round trip accrues nothing. With daily bars the two agree; only
   * leveraged intraday trades differ. The elapsed-time model is kept on
   * purpose, because an overnight model needs a timezone and cutoff that give
   * plausible but wrong numbers when set wrong, and would still approximate
   * real billing. For a 360-day basis, pass `interestRate * 365 / 360`.
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
  /**
   * Interest owed and not yet paid, as of the last margin check. The engine
   * settles interest in cash when a position (or part of it) closes; until
   * then it counts here, so equity and the margin ratio already reflect it.
   */
  accumulatedInterest: number;
};

/** Every margin call action {@link MarginConfig} allows. */
const MARGIN_CALL_ACTIONS = keywords<MarginConfig["marginCallAction"]>()([
  "liquidate",
  "reduceToMaintenance",
]);

/**
 * Reject a margin configuration the engine cannot honour.
 *
 * `leverage` below 1 is not "partial deployment": the loan it implies is
 * negative, and a negative loan is never repaid, so the undeployed cash
 * silently vanished at the first exit. `maintenanceMargin` is a ratio of
 * equity to position value, so it must lie in [0, 1) — a percentage such as
 * `30` margin-calls every bar. `0` is allowed: it calls only once equity
 * turns negative, which then liquidates (the reduction fraction is
 * unbounded). A ratio above `1 / leverage` is accepted but calls on the
 * entry bar, since a full-size entry starts at that ratio (less any entry
 * commission and adverse move).
 *
 * @example
 * ```ts
 * assertValidMarginConfig({ leverage: 2, maintenanceMargin: 0.25, marginCallAction: "liquidate" });
 * ```
 */
export function assertValidMarginConfig(config: MarginConfig): void {
  // Negated ranges so NaN is rejected rather than slipping through.
  if (!(config.leverage >= 1 && Number.isFinite(config.leverage))) {
    throw new Error(`margin.leverage must be a finite number >= 1, got ${config.leverage}`);
  }
  if (!(config.maintenanceMargin >= 0 && config.maintenanceMargin < 1)) {
    throw new Error(
      `margin.maintenanceMargin must be a ratio in [0, 1) (e.g. 0.25 for 25%), got ${config.maintenanceMargin}`,
    );
  }
  if (
    config.interestRate !== undefined &&
    !(config.interestRate >= 0 && Number.isFinite(config.interestRate))
  ) {
    throw new Error(
      `margin.interestRate must be a finite number >= 0 (e.g. 0.05 for 5%), got ${config.interestRate}`,
    );
  }
  // An unknown action used to reduce to maintenance instead of liquidating.
  if (config.marginCallAction !== undefined) {
    assertOneOf("margin.marginCallAction", config.marginCallAction, MARGIN_CALL_ACTIONS);
  }
}

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
  assertPositionDirection("accountEquity direction", direction);
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
  assertPositionDirection("updateMarginState direction", direction);
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
