import { describe, expect, it, vi } from "vitest";
import type { NormalizedCandle } from "../../types";
import { createLiveCandle } from "../live-candle";
import type { LiveCandleCompleteEvent, LiveTickEvent, Trade } from "../types";

function createMockIndicator(startValue: number, step: number) {
  let value = startValue;
  let count = 0;
  return {
    next(candle: NormalizedCandle) {
      const v = value;
      value += step;
      count++;
      return { time: candle.time, value: v };
    },
    peek(candle: NormalizedCandle) {
      return { time: candle.time, value };
    },
    getState() {
      return { value, count };
    },
    get count() {
      return count;
    },
    get isWarmedUp() {
      return count > 0;
    },
  };
}

function trade(time: number, price: number, volume = 1): Trade {
  return { time, price, volume };
}

function candle(
  time: number,
  o: number,
  h: number,
  l: number,
  c: number,
  v = 100,
): NormalizedCandle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

const INTERVAL = 60_000;

describe("createLiveCandle", () => {
  // ===========================
  // Tick mode
  // ===========================
  describe("tick mode", () => {
    it("should update forming candle on addTick", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      live.addTick(trade(0, 100));
      expect(live.candle).toBeTruthy();
      expect(live.candle!.open).toBe(100);
    });

    it("should push completed candle to completedCandles", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      live.addTick(trade(0, 100));
      expect(live.completedCandles).toHaveLength(0);

      // New period → completes first candle
      live.addTick(trade(INTERVAL, 110));
      expect(live.completedCandles).toHaveLength(1);
      expect(live.completedCandles[0].open).toBe(100);
    });

    it("should fire tick event on every addTick", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      const tickCb = vi.fn();
      live.on("tick", tickCb);

      live.addTick(trade(0, 100));
      live.addTick(trade(1000, 101));
      live.addTick(trade(2000, 102));
      expect(tickCb).toHaveBeenCalledTimes(3);
    });

    it("should set isNewCandle correctly", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      const results: boolean[] = [];
      live.on("tick", ({ isNewCandle }) => results.push(isNewCandle));

      live.addTick(trade(0, 100));
      live.addTick(trade(30_000, 105));
      live.addTick(trade(INTERVAL, 110)); // completes first candle
      live.addTick(trade(INTERVAL + 1000, 111));

      expect(results).toEqual([false, false, true, false]);
    });

    it("should use peek for forming and next for completed snapshots", () => {
      const live = createLiveCandle({
        intervalMs: INTERVAL,
        indicators: [{ name: "mock", create: () => createMockIndicator(10, 1) }],
      });

      const tickSnaps: unknown[] = [];
      const completeSnaps: unknown[] = [];
      live.on("tick", ({ snapshot }) => tickSnaps.push(snapshot.mock));
      live.on("candleComplete", ({ snapshot }) => completeSnaps.push(snapshot.mock));

      // First tick: no completion, peek sees value=10 (not yet advanced)
      live.addTick(trade(0, 100));
      expect(tickSnaps[0]).toBe(10);

      // Second period: completes candle, next returns 10 and advances to 11
      // then peek on forming sees 11
      live.addTick(trade(INTERVAL, 110));
      expect(completeSnaps[0]).toBe(10);
      expect(tickSnaps[1]).toBe(11); // peek after next
    });

    it("should throw when addTick is called without intervalMs", () => {
      const live = createLiveCandle({});
      expect(() => live.addTick(trade(0, 100))).toThrow("intervalMs is required");
    });
  });

  // ===========================
  // Candle mode
  // ===========================
  describe("candle mode", () => {
    it("should push confirmed candle to completedCandles and fire candleComplete", () => {
      const live = createLiveCandle({});
      const completeCb = vi.fn();
      live.on("candleComplete", completeCb);

      const c = candle(0, 100, 110, 95, 105);
      live.addCandle(c);

      expect(live.completedCandles).toHaveLength(1);
      expect(completeCb).toHaveBeenCalledTimes(1);
      expect(completeCb.mock.calls[0][0].candle).toBe(c);
    });

    it("should use peek only for partial candle", () => {
      const live = createLiveCandle({
        indicators: [{ name: "mock", create: () => createMockIndicator(10, 1) }],
      });

      const c = candle(0, 100, 110, 95, 105);
      live.addCandle(c, { partial: true });

      // partial → peek, no advancement → completedCandles empty
      expect(live.completedCandles).toHaveLength(0);
      expect(live.snapshot.mock).toBe(10); // peek sees initial value
    });

    it("should fire tick event with isNewCandle true for confirmed candle", () => {
      const live = createLiveCandle({});
      const tickCb = vi.fn();
      live.on("tick", tickCb);

      live.addCandle(candle(0, 100, 110, 95, 105));
      expect(tickCb).toHaveBeenCalledTimes(1);
      expect(tickCb.mock.calls[0][0].isNewCandle).toBe(true);
    });

    it("should fire tick event with isNewCandle false for partial candle", () => {
      const live = createLiveCandle({});
      const tickCb = vi.fn();
      live.on("tick", tickCb);

      live.addCandle(candle(0, 100, 110, 95, 105), { partial: true });
      expect(tickCb).toHaveBeenCalledTimes(1);
      expect(tickCb.mock.calls[0][0].isNewCandle).toBe(false);
    });
  });

  // ===========================
  // Common
  // ===========================
  describe("indicator management", () => {
    it("should catch up late-added indicator with history + completedCandles", () => {
      const history = [candle(0, 100, 110, 95, 105), candle(INTERVAL, 105, 115, 100, 110)];

      const live = createLiveCandle({ history });

      // Add 2 confirmed candles
      live.addCandle(candle(INTERVAL * 2, 110, 120, 105, 115));
      live.addCandle(candle(INTERVAL * 3, 115, 125, 110, 120));

      // Late add — should catch up: 2 history + 2 completed = 4 next() calls
      let instanceRef: ReturnType<typeof createMockIndicator> | null = null;
      live.addIndicator("late", (s) => {
        instanceRef = createMockIndicator(0, 1);
        return instanceRef;
      });

      expect(instanceRef!.count).toBe(4);
    });

    it("should remove indicator from snapshot", () => {
      const live = createLiveCandle({
        indicators: [
          { name: "a", create: () => createMockIndicator(1, 0) },
          { name: "b", create: () => createMockIndicator(2, 0) },
        ],
      });

      live.addCandle(candle(0, 100, 110, 95, 105));
      expect(live.snapshot.a).toBe(1);
      expect(live.snapshot.b).toBe(2);

      live.removeIndicator("a");
      live.addCandle(candle(INTERVAL, 105, 115, 100, 110));
      expect(live.snapshot.a).toBeUndefined();
      expect(live.snapshot.b).toBe(2);
    });
  });

  describe("events", () => {
    it("should unsubscribe via returned function", () => {
      const live = createLiveCandle({});
      const cb = vi.fn();
      const unsub = live.on("candleComplete", cb);

      live.addCandle(candle(0, 100, 110, 95, 105));
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      live.addCandle(candle(INTERVAL, 105, 115, 100, 110));
      expect(cb).toHaveBeenCalledTimes(1); // not called again
    });

    it("should support multiple listeners with independent unsubscribe", () => {
      const live = createLiveCandle({});
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = live.on("candleComplete", cb1);
      live.on("candleComplete", cb2);

      live.addCandle(candle(0, 100, 110, 95, 105));
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub1();
      live.addCandle(candle(INTERVAL, 105, 115, 100, 110));
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(2);
    });
  });

  describe("flush", () => {
    it("should force-complete current candle and fire candleComplete", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      const completeCb = vi.fn();
      live.on("candleComplete", completeCb);

      live.addTick(trade(0, 100));
      live.addTick(trade(1000, 110));

      const flushed = live.flush();
      expect(flushed).toBeTruthy();
      expect(flushed!.open).toBe(100);
      expect(flushed!.close).toBe(110);
      expect(live.completedCandles).toHaveLength(1);
      expect(completeCb).toHaveBeenCalledTimes(1);
    });

    it("should return null when no forming candle", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      expect(live.flush()).toBeNull();
    });

    it("should return null without aggregator (candle mode)", () => {
      const live = createLiveCandle({});
      expect(live.flush()).toBeNull();
    });
  });

  describe("state persistence", () => {
    it("should roundtrip via getState / fromState", () => {
      const live1 = createLiveCandle({
        intervalMs: INTERVAL,
        indicators: [{ name: "mock", create: (s) => createMockIndicator(10, 1) }],
      });

      live1.addTick(trade(0, 100));
      live1.addTick(trade(INTERVAL, 110)); // completes first candle
      live1.addTick(trade(INTERVAL + 1000, 115));

      const state = live1.getState();
      expect(state.completedCandles).toHaveLength(1);
      expect(state.indicatorEntries).toHaveLength(1);
      expect(state.aggregatorState).toBeTruthy();

      // Restore — indicators use fromState (no warm-up)
      const live2 = createLiveCandle(
        {
          intervalMs: INTERVAL,
          indicators: [
            {
              name: "mock",
              create: (s) => {
                // Verify state is passed through
                expect(s).toEqual(state.indicatorEntries[0].state);
                return createMockIndicator(10, 1);
              },
            },
          ],
        },
        state,
      );

      expect(live2.completedCandles).toHaveLength(1);
    });
  });

  describe("history warm-up", () => {
    it("should warm up indicators with provided history", () => {
      const history = [
        candle(0, 100, 110, 95, 105),
        candle(INTERVAL, 105, 115, 100, 110),
        candle(INTERVAL * 2, 110, 120, 105, 115),
      ];

      let instanceRef: ReturnType<typeof createMockIndicator> | null = null;
      const live = createLiveCandle({
        history,
        indicators: [
          {
            name: "mock",
            create: () => {
              instanceRef = createMockIndicator(10, 1);
              return instanceRef;
            },
          },
        ],
      });

      // Indicator should have processed 3 history candles
      expect(instanceRef!.count).toBe(3);
    });
  });

  describe("maxHistory", () => {
    it("should bound completedCandles to maxHistory", () => {
      const live = createLiveCandle({ maxHistory: 3 });

      for (let i = 0; i < 5; i++) {
        live.addCandle(candle(i * INTERVAL, 100 + i, 110 + i, 95 + i, 105 + i));
      }

      expect(live.completedCandles).toHaveLength(3);
      // Should keep the last 3
      expect(live.completedCandles[0].open).toBe(102);
      expect(live.completedCandles[2].open).toBe(104);
    });
  });

  describe("reentrancy", () => {
    it("should queue addCandle calls made inside callbacks", () => {
      const live = createLiveCandle({});
      const order: string[] = [];

      live.on("candleComplete", ({ candle: c }) => {
        order.push(`complete:${c.open}`);
        // Re-entrant call
        if (c.open === 100) {
          live.addCandle(candle(INTERVAL, 200, 210, 195, 205));
        }
      });

      live.on("tick", ({ candle: c }) => {
        order.push(`tick:${c.open}`);
      });

      live.addCandle(candle(0, 100, 110, 95, 105));

      // First candle events fire, then re-entrant candle is processed
      expect(order).toEqual(["complete:100", "tick:100", "complete:200", "tick:200"]);
      expect(live.completedCandles).toHaveLength(2);
    });
  });

  describe("dispose", () => {
    it("should clear listeners and throw on subsequent addTick/addCandle", () => {
      const live = createLiveCandle({ intervalMs: INTERVAL });
      const cb = vi.fn();
      live.on("tick", cb);

      live.dispose();

      expect(() => live.addTick(trade(0, 100))).toThrow("disposed");
      expect(() => live.addCandle(candle(0, 100, 110, 95, 105))).toThrow("disposed");
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should throw on duplicate indicator name", () => {
      const live = createLiveCandle({
        indicators: [{ name: "a", create: () => createMockIndicator(0, 0) }],
      });

      expect(() => live.addIndicator("a", () => createMockIndicator(0, 0))).toThrow(
        'Indicator "a" already registered',
      );
    });

    it("should return undefined for unknown indicator name", () => {
      const live = createLiveCandle({});
      expect(live.getIndicator("nonexistent")).toBeUndefined();
    });
  });
});
