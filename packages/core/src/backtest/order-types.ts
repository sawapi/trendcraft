/**
 * Limit/Stop order types and fill logic for the backtest engine.
 *
 * @module order-types
 */

import type { NormalizedCandle, PositionDirection } from "../types";

// ---------------------------------------------------------------------------
// Price resolver helpers
// ---------------------------------------------------------------------------

/** A function that computes a limit price from the signal candle and ATR. */
export type LimitPriceFunc = (entryCandle: NormalizedCandle, atr: number) => number;

/** A function that computes a stop price from the signal candle and ATR. */
export type StopPriceFunc = (entryCandle: NormalizedCandle, atr: number) => number;

// ---------------------------------------------------------------------------
// Time in Force (TIF)
// ---------------------------------------------------------------------------

/**
 * Time in Force — controls how long an order stays active and how it fills.
 *
 * - `"day"` — Valid for 1 bar only. Canceled if not filled.
 * - `"gtc"` — Good Till Cancel. Stays active for `orderTTL` bars (default: Infinity).
 * - `"ioc"` — Immediate or Cancel. Attempts fill on the next bar only.
 *   Partial fill allowed (respects `volumeConstraint`). Unfilled portion is canceled.
 * - `"fok"` — Fill or Kill. Attempts fill on the next bar only.
 *   Must fill the entire order or the whole order is canceled (no partial fill).
 * - `"opg"` — At the Open. Fills at the next bar's open price regardless of order type
 *   (limit/stop conditions are ignored — behaves like a market order at open).
 * - `"cls"` — At the Close. Fills at the next bar's close price regardless of order type.
 *
 * @example
 * ```ts
 * // Limit order valid for today only
 * { orderType: { type: "limit", price: 100 }, timeInForce: "day" }
 *
 * // Fill or kill — all shares or nothing
 * { orderType: { type: "limit", price: 100 }, timeInForce: "fok" }
 * ```
 */
export type TimeInForce = "day" | "gtc" | "ioc" | "fok" | "opg" | "cls";

/**
 * Resolve TimeInForce to effective TTL (in bars) and behavior flags.
 *
 * @param tif - Time in Force value
 * @param orderTTL - User-specified TTL (used for "gtc" only)
 * @returns Resolved TTL in bars, whether partial fills are allowed, and fill-price override
 */
export function resolveTimeInForce(
  tif: TimeInForce,
  orderTTL: number = Number.POSITIVE_INFINITY,
): {
  ttlBars: number;
  allowPartialFill: boolean;
  fillPriceOverride: "open" | "close" | null;
} {
  switch (tif) {
    case "gtc":
      return { ttlBars: orderTTL, allowPartialFill: true, fillPriceOverride: null };
    case "fok":
      return { ttlBars: 1, allowPartialFill: false, fillPriceOverride: null };
    case "opg":
      return { ttlBars: 1, allowPartialFill: true, fillPriceOverride: "open" };
    case "cls":
      return { ttlBars: 1, allowPartialFill: true, fillPriceOverride: "close" };
    case "day":
    case "ioc":
      return { ttlBars: 1, allowPartialFill: true, fillPriceOverride: null };
  }
}

// ---------------------------------------------------------------------------
// Preset Limit/Stop Price Strategies
// ---------------------------------------------------------------------------

/**
 * Fixed offset below signal candle's close (for limit buy).
 * Offers a discount entry by waiting for a dip from the signal price.
 *
 * @param offsetPercent - Percentage below close to place limit (e.g., 1 = 1% below)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Buy 1% below the signal bar's close
 * const order: OrderType = { type: "limit", price: limitBelowClose(1) };
 * ```
 */
export function limitBelowClose(offsetPercent: number): LimitPriceFunc {
  return (candle) => candle.close * (1 - offsetPercent / 100);
}

/**
 * Fixed offset above signal candle's close (for limit sell / short entry).
 *
 * @param offsetPercent - Percentage above close to place limit (e.g., 1 = 1% above)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Short entry 1% above the signal bar's close
 * const order: OrderType = { type: "limit", price: limitAboveClose(1) };
 * ```
 */
export function limitAboveClose(offsetPercent: number): LimitPriceFunc {
  return (candle) => candle.close * (1 + offsetPercent / 100);
}

/**
 * ATR-based limit price — place limit N × ATR below the signal close.
 * Adapts to current volatility: wider offset in volatile markets,
 * tighter in quiet markets.
 *
 * @param atrMultiplier - How many ATRs below close to place the limit (e.g., 0.5)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Buy 0.5 ATR below close — adapts to volatility
 * const order: OrderType = { type: "limit", price: limitAtrBelow(0.5) };
 * ```
 */
export function limitAtrBelow(atrMultiplier: number): LimitPriceFunc {
  return (candle, atr) => candle.close - atr * atrMultiplier;
}

/**
 * ATR-based limit price — place limit N × ATR above the signal close.
 *
 * @param atrMultiplier - How many ATRs above close (e.g., 0.5)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Short entry 0.5 ATR above close
 * const order: OrderType = { type: "limit", price: limitAtrAbove(0.5) };
 * ```
 */
export function limitAtrAbove(atrMultiplier: number): LimitPriceFunc {
  return (candle, atr) => candle.close + atr * atrMultiplier;
}

/**
 * Limit at the signal candle's low (support-level entry).
 * Assumes the low of the signal candle acts as a support level.
 *
 * @param buffer - Optional buffer in percent below the low (default: 0)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Buy at signal bar's low (intrabar support)
 * const order: OrderType = { type: "limit", price: limitAtLow() };
 *
 * // Buy slightly below the low for confirmation
 * const order2: OrderType = { type: "limit", price: limitAtLow(0.1) };
 * ```
 */
export function limitAtLow(buffer = 0): LimitPriceFunc {
  return (candle) => candle.low * (1 - buffer / 100);
}

/**
 * Limit at the signal candle's high (resistance-level entry for shorts).
 *
 * @param buffer - Optional buffer in percent above the high (default: 0)
 * @returns LimitPriceFunc
 *
 * @example
 * ```ts
 * // Short at signal bar's high (intrabar resistance)
 * const order: OrderType = { type: "limit", price: limitAtHigh() };
 * ```
 */
export function limitAtHigh(buffer = 0): LimitPriceFunc {
  return (candle) => candle.high * (1 + buffer / 100);
}

/**
 * Stop order for breakout above signal candle's high.
 * Buys only if price breaks above the signal bar's high — confirms momentum.
 *
 * @param buffer - Optional buffer in percent above the high (default: 0)
 * @returns StopPriceFunc
 *
 * @example
 * ```ts
 * // Buy breakout above signal bar's high
 * const order: OrderType = { type: "stop", price: stopAboveHigh() };
 *
 * // With 0.1% buffer to filter noise
 * const order2: OrderType = { type: "stop", price: stopAboveHigh(0.1) };
 * ```
 */
export function stopAboveHigh(buffer = 0): StopPriceFunc {
  return (candle) => candle.high * (1 + buffer / 100);
}

/**
 * Stop order for breakdown below signal candle's low (short breakout).
 *
 * @param buffer - Optional buffer in percent below the low (default: 0)
 * @returns StopPriceFunc
 *
 * @example
 * ```ts
 * // Short breakdown below signal bar's low
 * const order: OrderType = { type: "stop", price: stopBelowLow() };
 * ```
 */
export function stopBelowLow(buffer = 0): StopPriceFunc {
  return (candle) => candle.low * (1 - buffer / 100);
}

/**
 * ATR-based stop order — breakout N × ATR above close.
 *
 * @param atrMultiplier - How many ATRs above close to place the stop (e.g., 1.0)
 * @returns StopPriceFunc
 *
 * @example
 * ```ts
 * // Buy breakout 1 ATR above close
 * const order: OrderType = { type: "stop", price: stopAtrAbove(1.0) };
 * ```
 */
export function stopAtrAbove(atrMultiplier: number): StopPriceFunc {
  return (candle, atr) => candle.close + atr * atrMultiplier;
}

/**
 * ATR-based stop order — breakdown N × ATR below close (for shorts).
 *
 * @param atrMultiplier - How many ATRs below close to place the stop (e.g., 1.0)
 * @returns StopPriceFunc
 *
 * @example
 * ```ts
 * // Short breakdown 1 ATR below close
 * const order: OrderType = { type: "stop", price: stopAtrBelow(1.0) };
 * ```
 */
export function stopAtrBelow(atrMultiplier: number): StopPriceFunc {
  return (candle, atr) => candle.close - atr * atrMultiplier;
}

// ---------------------------------------------------------------------------
// OrderType
// ---------------------------------------------------------------------------

/** Market order — fills immediately at the next candle's open. */
export type MarketOrder = { type: "market" };

/**
 * Limit order — buy below (long) or sell above (short) the specified price.
 *
 * @example
 * ```ts
 * const order: LimitOrder = {
 *   type: "limit",
 *   price: (candle, atr) => candle.close - atr * 0.5,
 * };
 * ```
 */
export type LimitOrder = { type: "limit"; price: number | LimitPriceFunc };

/**
 * Stop order — buy above (long, breakout) or sell below (short) the specified price.
 *
 * @example
 * ```ts
 * const order: StopOrder = {
 *   type: "stop",
 *   price: (candle, atr) => candle.high + atr * 0.2,
 * };
 * ```
 */
export type StopOrder = { type: "stop"; price: number | StopPriceFunc };

/**
 * Stop-limit order — a stop trigger followed by a limit fill.
 *
 * @example
 * ```ts
 * const order: StopLimitOrder = {
 *   type: "stopLimit",
 *   stopPrice: (candle, atr) => candle.high + atr * 0.2,
 *   limitPrice: (candle, atr) => candle.high + atr * 0.5,
 * };
 * ```
 */
export type StopLimitOrder = {
  type: "stopLimit";
  stopPrice: number | StopPriceFunc;
  limitPrice: number | LimitPriceFunc;
};

/** Union of all supported order types. */
export type OrderType = MarketOrder | LimitOrder | StopOrder | StopLimitOrder;

// ---------------------------------------------------------------------------
// PendingOrder
// ---------------------------------------------------------------------------

/**
 * Represents a pending (not yet filled) order in the backtest engine.
 *
 * @example
 * ```ts
 * const pending: PendingOrder = {
 *   orderType: { type: "limit", price: 100 },
 *   direction: "long",
 *   signalTime: 1700000000000,
 *   signalIndex: 42,
 *   entryAtr: 2.5,
 *   barsRemaining: 5,
 * };
 * ```
 */
export type PendingOrder = {
  /** The order type that determines fill logic. */
  orderType: OrderType;
  /** Position direction once the order is filled. */
  direction: PositionDirection;
  /** Timestamp of the candle that generated the signal. */
  signalTime: number;
  /** Index of the signal candle in the data array. */
  signalIndex: number;
  /** ATR value at signal time (used to resolve price functions). `null` if ATR is unavailable. */
  entryAtr: number | null;
  /** Number of bars the order remains active before expiring. Decremented each bar. */
  barsRemaining: number;
  /** For stopLimit orders: `true` once the stop price has been triggered. */
  stopActivated?: boolean;
  /** Whether partial fills are allowed (from TIF resolution). Default: true. */
  allowPartialFill?: boolean;
  /** Override fill price source: "open" (opg) or "close" (cls). null = normal logic. */
  fillPriceOverride?: "open" | "close" | null;
};

// ---------------------------------------------------------------------------
// Fill result
// ---------------------------------------------------------------------------

/** Result returned by {@link tryFillOrder} when the order is filled. */
export type FillResult = {
  filled: true;
  fillPrice: number;
};

// ---------------------------------------------------------------------------
// resolvePrice
// ---------------------------------------------------------------------------

/**
 * Resolve a static or function-based price to a concrete number.
 *
 * @param price - A fixed number or a function `(candle, atr) => number`.
 * @param candle - The current candle used when `price` is a function.
 * @param atr - The ATR value passed to the price function.
 * @returns The resolved numeric price.
 *
 * @example
 * ```ts
 * resolvePrice(100, candle, 2.5);                       // => 100
 * resolvePrice((c, a) => c.close - a, candle, 2.5);     // => candle.close - 2.5
 * ```
 */
export function resolvePrice(
  price: number | ((candle: NormalizedCandle, atr: number) => number),
  candle: NormalizedCandle,
  atr: number,
): number {
  return typeof price === "function" ? price(candle, atr) : price;
}

// ---------------------------------------------------------------------------
// tryFillOrder
// ---------------------------------------------------------------------------

/**
 * Attempt to fill a pending order against the given candle.
 *
 * Returns a {@link FillResult} when the order is filled, or `null` if the
 * fill conditions are not met on this candle.
 *
 * Fill semantics per order type:
 * - **market** — always fills at `candle.open`.
 * - **limit (long)** — fills when `candle.low <= limitPrice` at `min(limitPrice, candle.open)`.
 * - **limit (short)** — fills when `candle.high >= limitPrice` at `max(limitPrice, candle.open)`.
 * - **stop (long)** — fills when `candle.high >= stopPrice` at `max(stopPrice, candle.open)`.
 * - **stop (short)** — fills when `candle.low <= stopPrice` at `min(stopPrice, candle.open)`.
 * - **stopLimit** — first the stop must trigger (same logic as a stop order), then the limit
 *   condition is checked. If both conditions are met on the same candle the order fills
 *   immediately. The `stopActivated` flag on the order is mutated to `true` when the stop
 *   triggers.
 *
 * @param order - The pending order to evaluate.
 * @param candle - The current candle to test against.
 * @returns A {@link FillResult} or `null`.
 *
 * @example
 * ```ts
 * const result = tryFillOrder(pendingOrder, currentCandle);
 * if (result) {
 *   console.log(`Filled at ${result.fillPrice}`);
 * }
 * ```
 */
export function tryFillOrder(order: PendingOrder, candle: NormalizedCandle): FillResult | null {
  // Handle fill-price overrides from TIF (opg/cls)
  if (order.fillPriceOverride === "open") {
    return { filled: true, fillPrice: candle.open };
  }
  if (order.fillPriceOverride === "close") {
    return { filled: true, fillPrice: candle.close };
  }

  const atr = order.entryAtr ?? 0;
  const { orderType, direction } = order;

  switch (orderType.type) {
    // ----- market -----
    case "market":
      return { filled: true, fillPrice: candle.open };

    // ----- limit -----
    case "limit": {
      const limitPrice = resolvePrice(orderType.price, candle, atr);
      if (direction === "long") {
        // Buy below limitPrice
        if (candle.low <= limitPrice) {
          return { filled: true, fillPrice: Math.min(limitPrice, candle.open) };
        }
      } else {
        // Sell above limitPrice
        if (candle.high >= limitPrice) {
          return { filled: true, fillPrice: Math.max(limitPrice, candle.open) };
        }
      }
      return null;
    }

    // ----- stop -----
    case "stop": {
      const stopPrice = resolvePrice(orderType.price, candle, atr);
      if (direction === "long") {
        // Breakout buy above stopPrice
        if (candle.high >= stopPrice) {
          return { filled: true, fillPrice: Math.max(stopPrice, candle.open) };
        }
      } else {
        // Breakdown sell below stopPrice
        if (candle.low <= stopPrice) {
          return { filled: true, fillPrice: Math.min(stopPrice, candle.open) };
        }
      }
      return null;
    }

    // ----- stopLimit -----
    case "stopLimit": {
      const stopPrice = resolvePrice(orderType.stopPrice, candle, atr);
      const limitPrice = resolvePrice(orderType.limitPrice, candle, atr);

      // Phase 1: check if stop is triggered (or was already activated)
      if (!order.stopActivated) {
        let stopTriggered = false;
        if (direction === "long") {
          stopTriggered = candle.high >= stopPrice;
        } else {
          stopTriggered = candle.low <= stopPrice;
        }

        if (!stopTriggered) {
          return null;
        }

        // Mutate the order to mark stop as activated
        order.stopActivated = true;
      }

      // Phase 2: check limit condition
      if (direction === "long") {
        if (candle.low <= limitPrice) {
          return { filled: true, fillPrice: Math.min(limitPrice, candle.open) };
        }
      } else {
        if (candle.high >= limitPrice) {
          return { filled: true, fillPrice: Math.max(limitPrice, candle.open) };
        }
      }

      return null;
    }
  }
}
