import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";
import type { PendingOrder } from "../order-types";
import {
  freezeOrderPrices,
  limitAboveClose,
  limitAtHigh,
  limitAtLow,
  limitAtrAbove,
  limitAtrBelow,
  limitBelowClose,
  resolvePrice,
  resolveTimeInForce,
  stopAboveHigh,
  stopAtrAbove,
  stopAtrBelow,
  stopBelowLow,
  tryFillOrder,
} from "../order-types";
import { at, never } from "./step-candles";

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
    expect(r.ttlBars).toBe(Number.POSITIVE_INFINITY);
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

// ---------------------------------------------------------------------------
// freezeOrderPrices — function prices resolve against the SIGNAL candle
// ---------------------------------------------------------------------------

describe("freezeOrderPrices", () => {
  const signalCandle: NormalizedCandle = {
    time: 500,
    open: 99,
    high: 100.4,
    low: 98,
    close: 100,
    volume: 5000,
  } as NormalizedCandle;

  it("resolves stop/limit/stopLimit function prices to signal-candle numbers", () => {
    const stop = freezeOrderPrices({ type: "stop", price: stopAboveHigh(0) }, signalCandle, 2);
    expect(stop).toEqual({ type: "stop", price: 100.4 });

    const limit = freezeOrderPrices({ type: "limit", price: limitBelowClose(1) }, signalCandle, 2);
    expect(limit).toEqual({ type: "limit", price: 99 });

    const stopLimit = freezeOrderPrices(
      { type: "stopLimit", stopPrice: stopAboveHigh(0), limitPrice: (c) => c.high + 1 },
      signalCandle,
      2,
    );
    expect(stopLimit).toEqual({ type: "stopLimit", stopPrice: 100.4, limitPrice: 101.4 });
  });

  it("a frozen stopAboveHigh(0) order does NOT fill in a falling market", () => {
    const frozen = freezeOrderPrices({ type: "stop", price: stopAboveHigh(0) }, signalCandle, 0);
    const order = makePending({ orderType: frozen, direction: "long" });
    // Every later bar stays below the signal high 100.4; an unfrozen function
    // would degenerate to `high >= high` and fill on the first bar.
    for (const high of [99.4, 98.4, 97.4]) {
      const bar = { time: 2000, open: high - 1, high, low: high - 2, close: high - 1.5 };
      expect(tryFillOrder(order, bar as NormalizedCandle)).toBeNull();
    }
    // A genuine later break of the frozen level fills at that level
    const breakout = { time: 3000, open: 100, high: 101, low: 99.5, close: 100.8 };
    expect(tryFillOrder(order, breakout as NormalizedCandle)).toEqual({
      filled: true,
      fillPrice: 100.4,
    });
  });

  it("a frozen limitBelowClose(1) order does NOT fill in a rallying market", () => {
    const frozen = freezeOrderPrices({ type: "limit", price: limitBelowClose(1) }, signalCandle, 0);
    const order = makePending({ orderType: frozen, direction: "long" });
    // Intended limit = signal close 100 * 0.99 = 99; price never dips there.
    // An unfrozen function re-derived from each bar's close would fill.
    for (const low of [100.1, 100.5, 101.2]) {
      const bar = { time: 2000, open: low + 1, high: low + 2, low, close: low + 1.5 };
      expect(tryFillOrder(order, bar as NormalizedCandle)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// tryFillOrder — stopLimit same-bar activation fill price
// ---------------------------------------------------------------------------

describe("tryFillOrder — stopLimit same-bar activation", () => {
  const bar = (o: number, h: number, l: number, c: number): NormalizedCandle =>
    ({ time: 1000, open: o, high: h, low: l, close: c, volume: 1000 }) as NormalizedCandle;

  it("long: fills at the stop trigger, not the pre-trigger open", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 105, limitPrice: 106 },
      direction: "long",
    });
    // open 100 is pre-trigger price action; the order goes live at 105
    const result = tryFillOrder(order, bar(100, 107, 99, 106));
    expect(result).toEqual({ filled: true, fillPrice: 105 });
  });

  it("short: fills at the stop trigger, not the pre-trigger open", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 95, limitPrice: 94 },
      direction: "short",
    });
    const result = tryFillOrder(order, bar(100, 101, 93, 94));
    expect(result).toEqual({ filled: true, fillPrice: 95 });
  });

  it("long gap through the stop: fills at the open (order live from the open)", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 100, limitPrice: 106 },
      direction: "long",
    });
    const result = tryFillOrder(order, bar(104, 107, 103, 105));
    expect(result).toEqual({ filled: true, fillPrice: 104 });
  });

  it("long triggered above the limit: fills at the limit only if the bar trades down to it", () => {
    const fills = makePending({
      orderType: { type: "stopLimit", stopPrice: 101, limitPrice: 102 },
      direction: "long",
    });
    // open 103 > limit 102 => not marketable at trigger; low 100 <= 102 => limit fill
    expect(tryFillOrder(fills, bar(103, 104, 100, 101))).toEqual({
      filled: true,
      fillPrice: 102,
    });

    const stays = makePending({
      orderType: { type: "stopLimit", stopPrice: 101, limitPrice: 102 },
      direction: "long",
    });
    // low 102.5 never reaches the limit => activated but unfilled this bar
    expect(tryFillOrder(stays, bar(103, 104, 102.5, 103.5))).toBeNull();
    expect(stays.stopActivated).toBe(true);
  });

  it("later bars (already activated) still fill like a resting limit at the open", () => {
    const order = makePending({
      orderType: { type: "stopLimit", stopPrice: 105, limitPrice: 106 },
      direction: "long",
      stopActivated: true,
    });
    // Already live before this bar opened: open fill is legitimate
    const result = tryFillOrder(order, bar(104, 106, 103, 105));
    expect(result).toEqual({ filled: true, fillPrice: 104 });
  });
});

// ---------------------------------------------------------------------------
// Engine integration — function prices resolve at signal time
// ---------------------------------------------------------------------------

describe("runBacktest with function-based order prices", () => {
  const day = 86400000;
  const mk = (i: number, o: number, h: number, l: number, c: number): NormalizedCandle =>
    ({
      time: 1700000000000 + i * day,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: 1000,
    }) as NormalizedCandle;

  it("stopAboveHigh(0) never fills in a falling market", () => {
    // Signal at bar 1 (high 100.4); every later high is lower, so a breakout
    // stop above the signal high must never trigger.
    const candles = [
      mk(0, 100, 100.9, 99, 100.2),
      mk(1, 100, 100.4, 99, 100),
      ...Array.from({ length: 8 }, (_, k) => {
        const h = 99.4 - k;
        return mk(2 + k, h - 1, h, h - 2, h - 1.5);
      }),
    ];
    const result = runBacktest(candles, at(1), never, {
      capital: 100000,
      orderType: { type: "stop", price: stopAboveHigh(0) },
    });
    expect(result.trades.length).toBe(0);
  });

  it("limitBelowClose(1) never fills in a rallying market", () => {
    // Signal close 100 => intended limit 99; later lows never dip below 100.
    const candles = [
      mk(0, 100, 101, 99.5, 100.2),
      mk(1, 100, 101, 99.8, 100),
      ...Array.from({ length: 8 }, (_, k) => {
        const l = 100.1 + k;
        return mk(2 + k, l + 1, l + 2, l, l + 1.5);
      }),
    ];
    const result = runBacktest(candles, at(1), never, {
      capital: 100000,
      orderType: { type: "limit", price: limitBelowClose(1) },
    });
    expect(result.trades.length).toBe(0);
  });

  it("a genuine later break of the signal-derived level fills at that level", () => {
    // Signal high 100.4 at bar 1; bar 3 breaks above it.
    const candles = [
      mk(0, 100, 100.9, 99, 100.2),
      mk(1, 100, 100.4, 99, 100),
      mk(2, 99.5, 100.0, 99, 99.8),
      mk(3, 100, 101.5, 99.9, 101),
      mk(4, 101, 102, 100.5, 101.5),
    ];
    const result = runBacktest(candles, at(1), never, {
      capital: 100000,
      orderType: { type: "stop", price: stopAboveHigh(0) },
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].entryPrice).toBeCloseTo(100.4, 10);
  });
});
