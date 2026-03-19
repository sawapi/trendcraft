import { describe, it, expect } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  resolvePrice,
  tryFillOrder,
  resolveTimeInForce,
  limitBelowClose,
  limitAboveClose,
  limitAtrBelow,
  limitAtrAbove,
  limitAtLow,
  limitAtHigh,
  stopAboveHigh,
  stopBelowLow,
  stopAtrAbove,
  stopAtrBelow,
} from "../order-types";
import type { PendingOrder } from "../order-types";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 10000,
} as NormalizedCandle;

/** Helper to build a PendingOrder with sensible defaults. */
function makePending(
  partial: Partial<PendingOrder> & Pick<PendingOrder, "orderType" | "direction">,
): PendingOrder {
  return {
    signalTime: 900,
    signalIndex: 0,
    entryAtr: 2,
    barsRemaining: 5,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// resolvePrice
// ---------------------------------------------------------------------------

describe("resolvePrice", () => {
  it("returns a static number as-is", () => {
    expect(resolvePrice(42, candle, 2)).toBe(42);
  });

  it("invokes a function with candle and atr", () => {
    const fn = (c: NormalizedCandle, atr: number) => c.close - atr;
    expect(resolvePrice(fn, candle, 2.5)).toBe(105 - 2.5);
  });
});

// ---------------------------------------------------------------------------
// tryFillOrder — Market
// ---------------------------------------------------------------------------

describe("tryFillOrder — market", () => {
  it("always fills at candle.open", () => {
    const order = makePending({
      orderType: { type: "market" },
      direction: "long",
    });
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 100 });
  });
});

// ---------------------------------------------------------------------------
// tryFillOrder — Limit
// ---------------------------------------------------------------------------

describe("tryFillOrder — limit", () => {
  it("long: fills when low <= limitPrice, fillPrice = min(limitPrice, open)", () => {
    const order = makePending({
      orderType: { type: "limit", price: 95 },
      direction: "long",
    });
    // low=90 <= 95 => fills, fillPrice = min(95, 100) = 95
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 95 });
  });

  it("long: fills at open when open < limitPrice and low <= limitPrice", () => {
    const order = makePending({
      orderType: { type: "limit", price: 105 },
      direction: "long",
    });
    // low=90 <= 105 => fills, fillPrice = min(105, 100) = 100
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 100 });
  });

  it("long: does not fill when low > limitPrice", () => {
    const order = makePending({
      orderType: { type: "limit", price: 85 },
      direction: "long",
    });
    // low=90 > 85 => no fill
    const result = tryFillOrder(order, candle);
    expect(result).toBeNull();
  });

  it("short: fills when high >= limitPrice", () => {
    const order = makePending({
      orderType: { type: "limit", price: 108 },
      direction: "short",
    });
    // high=110 >= 108 => fills, fillPrice = max(108, 100) = 108
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 108 });
  });

  it("short: does not fill when high < limitPrice", () => {
    const order = makePending({
      orderType: { type: "limit", price: 115 },
      direction: "short",
    });
    // high=110 < 115 => no fill
    const result = tryFillOrder(order, candle);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tryFillOrder — Stop
// ---------------------------------------------------------------------------

describe("tryFillOrder — stop", () => {
  it("long: fills when high >= stopPrice, fillPrice = max(stopPrice, open)", () => {
    const order = makePending({
      orderType: { type: "stop", price: 108 },
      direction: "long",
    });
    // high=110 >= 108 => fills, fillPrice = max(108, 100) = 108
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 108 });
  });

  it("long: does not fill when high < stopPrice", () => {
    const order = makePending({
      orderType: { type: "stop", price: 115 },
      direction: "long",
    });
    // high=110 < 115 => no fill
    const result = tryFillOrder(order, candle);
    expect(result).toBeNull();
  });

  it("short: fills when low <= stopPrice", () => {
    const order = makePending({
      orderType: { type: "stop", price: 92 },
      direction: "short",
    });
    // low=90 <= 92 => fills, fillPrice = min(92, 100) = 92
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 92 });
  });

  it("short: does not fill when low > stopPrice", () => {
    const order = makePending({
      orderType: { type: "stop", price: 85 },
      direction: "short",
    });
    // low=90 > 85 => no fill
    const result = tryFillOrder(order, candle);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tryFillOrder — StopLimit
// ---------------------------------------------------------------------------

describe("tryFillOrder — stopLimit", () => {
  it("two-phase: stop triggers on first candle, limit fills on second candle", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 108, limitPrice: 95 },
      direction: "long",
    });

    // First candle: stop triggers (high=110 >= 108) but limit not met (low=90 <= 95 — actually met!)
    // Use a candle where limit is NOT met for a true two-phase test
    const candle1: NormalizedCandle = {
      time: 1000,
      open: 100,
      high: 110,
      low: 97,
      close: 105,
      volume: 10000,
    } as NormalizedCandle;

    const result1 = tryFillOrder(order, candle1);
    // stop triggers (high=110 >= 108), but limit not met (low=97 > 95)
    expect(result1).toBeNull();
    expect(order.stopActivated).toBe(true);

    // Second candle: limit fills
    const candle2: NormalizedCandle = {
      time: 2000,
      open: 98,
      high: 102,
      low: 93,
      close: 99,
      volume: 8000,
    } as NormalizedCandle;

    const result2 = tryFillOrder(order, candle2);
    // low=93 <= 95 => fills, fillPrice = min(95, 98) = 95
    expect(result2).toEqual({ filled: true, fillPrice: 95 });
  });

  it("both phases resolve on the same candle", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 108, limitPrice: 95 },
      direction: "long",
    });
    // high=110 >= 108 (stop triggers), low=90 <= 95 (limit met)
    // fillPrice = min(95, 100) = 95
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 95 });
    expect(order.stopActivated).toBe(true);
  });

  it("does not fill when stop is not triggered", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 115, limitPrice: 95 },
      direction: "long",
    });
    // high=110 < 115 => stop not triggered
    const result = tryFillOrder(order, candle);
    expect(result).toBeNull();
    expect(order.stopActivated).toBeUndefined();
  });

  it("short: stop triggers when low <= stopPrice, limit fills when high >= limitPrice", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 92, limitPrice: 108 },
      direction: "short",
    });
    // low=90 <= 92 (stop triggers), high=110 >= 108 (limit met)
    // fillPrice = max(108, 100) = 108
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 108 });
    expect(order.stopActivated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TTL expiration
// ---------------------------------------------------------------------------

describe("tryFillOrder — TTL expiration", () => {
  it("barsRemaining tracks towards expiration", () => {
    const order = makePending({
      orderType: { type: "limit", price: 85 },
      direction: "long",
      barsRemaining: 2,
    });

    // Bar 1: no fill (low=90 > 85)
    expect(tryFillOrder(order, candle)).toBeNull();
    order.barsRemaining--;
    expect(order.barsRemaining).toBe(1);

    // Bar 2: no fill
    expect(tryFillOrder(order, candle)).toBeNull();
    order.barsRemaining--;
    expect(order.barsRemaining).toBe(0);

    // Bar 3: expired (barsRemaining goes negative)
    order.barsRemaining--;
    expect(order.barsRemaining).toBe(-1);
    expect(order.barsRemaining < 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Preset limit/stop price strategies
// ---------------------------------------------------------------------------

describe("preset limit strategies", () => {
  const c: NormalizedCandle = {
    time: 1000,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 10000,
  };
  const atrVal = 5;

  it("limitBelowClose: 1% below close", () => {
    const fn = limitBelowClose(1);
    expect(fn(c, atrVal)).toBeCloseTo(105 * 0.99);
  });

  it("limitAboveClose: 2% above close", () => {
    const fn = limitAboveClose(2);
    expect(fn(c, atrVal)).toBeCloseTo(105 * 1.02);
  });

  it("limitAtrBelow: 0.5 ATR below close", () => {
    const fn = limitAtrBelow(0.5);
    expect(fn(c, atrVal)).toBeCloseTo(105 - 5 * 0.5); // 102.5
  });

  it("limitAtrAbove: 1.0 ATR above close", () => {
    const fn = limitAtrAbove(1.0);
    expect(fn(c, atrVal)).toBeCloseTo(105 + 5); // 110
  });

  it("limitAtLow: at signal bar's low", () => {
    const fn = limitAtLow();
    expect(fn(c, atrVal)).toBe(90);
  });

  it("limitAtLow: with 0.5% buffer below low", () => {
    const fn = limitAtLow(0.5);
    expect(fn(c, atrVal)).toBeCloseTo(90 * 0.995);
  });

  it("limitAtHigh: at signal bar's high", () => {
    const fn = limitAtHigh();
    expect(fn(c, atrVal)).toBe(110);
  });

  it("limitAtHigh: with 0.2% buffer above high", () => {
    const fn = limitAtHigh(0.2);
    expect(fn(c, atrVal)).toBeCloseTo(110 * 1.002);
  });
});

describe("preset stop strategies", () => {
  const c: NormalizedCandle = {
    time: 1000,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 10000,
  };
  const atrVal = 5;

  it("stopAboveHigh: breakout above high", () => {
    const fn = stopAboveHigh();
    expect(fn(c, atrVal)).toBe(110);
  });

  it("stopAboveHigh: with 0.1% buffer", () => {
    const fn = stopAboveHigh(0.1);
    expect(fn(c, atrVal)).toBeCloseTo(110 * 1.001);
  });

  it("stopBelowLow: breakdown below low", () => {
    const fn = stopBelowLow();
    expect(fn(c, atrVal)).toBe(90);
  });

  it("stopAtrAbove: 1 ATR above close", () => {
    const fn = stopAtrAbove(1.0);
    expect(fn(c, atrVal)).toBeCloseTo(105 + 5); // 110
  });

  it("stopAtrBelow: 1 ATR below close", () => {
    const fn = stopAtrBelow(1.0);
    expect(fn(c, atrVal)).toBeCloseTo(105 - 5); // 100
  });
});

// ---------------------------------------------------------------------------
// Time in Force (TIF)
// ---------------------------------------------------------------------------

describe("resolveTimeInForce", () => {
  it("day: TTL=1, partial OK, no price override", () => {
    const r = resolveTimeInForce("day");
    expect(r.ttlBars).toBe(1);
    expect(r.allowPartialFill).toBe(true);
    expect(r.fillPriceOverride).toBeNull();
  });

  it("gtc: uses orderTTL, partial OK", () => {
    const r = resolveTimeInForce("gtc", 10);
    expect(r.ttlBars).toBe(10);
    expect(r.allowPartialFill).toBe(true);
    expect(r.fillPriceOverride).toBeNull();
  });

  it("gtc: defaults to Infinity", () => {
    const r = resolveTimeInForce("gtc");
    expect(r.ttlBars).toBe(Infinity);
  });

  it("ioc: TTL=1, partial OK", () => {
    const r = resolveTimeInForce("ioc");
    expect(r.ttlBars).toBe(1);
    expect(r.allowPartialFill).toBe(true);
  });

  it("fok: TTL=1, no partial fill", () => {
    const r = resolveTimeInForce("fok");
    expect(r.ttlBars).toBe(1);
    expect(r.allowPartialFill).toBe(false);
    expect(r.fillPriceOverride).toBeNull();
  });

  it("opg: fills at open", () => {
    const r = resolveTimeInForce("opg");
    expect(r.ttlBars).toBe(1);
    expect(r.fillPriceOverride).toBe("open");
  });

  it("cls: fills at close", () => {
    const r = resolveTimeInForce("cls");
    expect(r.ttlBars).toBe(1);
    expect(r.fillPriceOverride).toBe("close");
  });
});

describe("tryFillOrder — TIF fillPriceOverride", () => {
  it("opg: fills at candle.open regardless of limit price", () => {
    const order = makePending({
      orderType: { type: "limit", price: 85 }, // normally wouldn't fill (low=90 > 85)
      direction: "long",
      fillPriceOverride: "open",
    });
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 100 }); // candle.open
  });

  it("cls: fills at candle.close regardless of limit price", () => {
    const order = makePending({
      orderType: { type: "limit", price: 85 },
      direction: "long",
      fillPriceOverride: "close",
    });
    const result = tryFillOrder(order, candle);
    expect(result).toEqual({ filled: true, fillPrice: 105 }); // candle.close
  });
});
