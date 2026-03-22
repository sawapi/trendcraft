import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { rsiAbove, rsiBelow } from "../conditions";
import { createTradingSession } from "../session";
import type { SessionEvent, Trade } from "../types";

/**
 * Mock indicator with a deterministic sequence
 */
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

describe("createTradingSession", () => {
  const INTERVAL = 60_000; // 1 minute

  it("should emit candle events when candles complete", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [{ name: "rsi", create: () => createMockIndicator(50, 0) }],
      },
    });

    // First trade
    let events = session.onTrade(trade(0, 100));
    expect(events).toEqual([]);

    // Same period trade
    events = session.onTrade(trade(30_000, 110));
    expect(events).toEqual([]);

    // New period → candle completes
    events = session.onTrade(trade(60_000, 105));
    const candleEvents = events.filter((e) => e.type === "candle");
    expect(candleEvents).toHaveLength(1);
    const ce = candleEvents[0] as { type: "candle"; candle: NormalizedCandle };
    expect(ce.candle.open).toBe(100);
    expect(ce.candle.high).toBe(110);
    expect(ce.candle.close).toBe(110);
  });

  it("should emit entry events when entry condition is met", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [
          // RSI starts at 25 (below 30)
          { name: "rsi", create: () => createMockIndicator(25, 0) },
        ],
        entry: rsiBelow(30),
      },
    });

    session.onTrade(trade(0, 100));
    const events = session.onTrade(trade(60_000, 105));
    const entryEvents = events.filter((e) => e.type === "entry");
    expect(entryEvents).toHaveLength(1);
  });

  it("should emit exit events when exit condition is met", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [
          // RSI at 75 (above 70)
          { name: "rsi", create: () => createMockIndicator(75, 0) },
        ],
        exit: rsiAbove(70),
      },
    });

    session.onTrade(trade(0, 100));
    const events = session.onTrade(trade(60_000, 105));
    const exitEvents = events.filter((e) => e.type === "exit");
    expect(exitEvents).toHaveLength(1);
  });

  it("should emit signal events for named signals", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [{ name: "rsi", create: () => createMockIndicator(25, 0) }],
        signals: [{ name: "oversold", condition: rsiBelow(30) }],
      },
    });

    session.onTrade(trade(0, 100));
    const events = session.onTrade(trade(60_000, 105));
    const signalEvents = events.filter((e) => e.type === "signal");
    expect(signalEvents).toHaveLength(1);
    expect((signalEvents[0] as { type: "signal"; name: string }).name).toBe("oversold");
  });

  it("should emit partial events when emitPartial is true", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [{ name: "rsi", create: () => createMockIndicator(50, 0) }],
      },
      emitPartial: true,
    });

    // First trade emits a partial event
    const events = session.onTrade(trade(0, 100));
    const partialEvents = events.filter((e) => e.type === "partial");
    expect(partialEvents).toHaveLength(1);
  });

  it("should not emit partial events by default", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [{ name: "rsi", create: () => createMockIndicator(50, 0) }],
      },
    });

    const events = session.onTrade(trade(0, 100));
    const partialEvents = events.filter((e) => e.type === "partial");
    expect(partialEvents).toHaveLength(0);
  });

  it("should flush remaining candle on close", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [{ name: "rsi", create: () => createMockIndicator(50, 0) }],
      },
    });

    session.onTrade(trade(0, 100));
    session.onTrade(trade(30_000, 110));

    const events = session.close();
    const candleEvents = events.filter((e) => e.type === "candle");
    expect(candleEvents).toHaveLength(1);
    const ce = candleEvents[0] as { type: "candle"; candle: NormalizedCandle };
    expect(ce.candle.open).toBe(100);
    expect(ce.candle.high).toBe(110);
    expect(ce.candle.close).toBe(110);
  });

  it("should return empty events from close when no data", () => {
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [],
      },
    });

    expect(session.close()).toEqual([]);
  });

  it("should warm up indicators with historical candles", () => {
    let callCount = 0;
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [
          {
            name: "counter",
            create: () => ({
              next() {
                callCount++;
                return { time: 0, value: callCount };
              },
              peek() {
                return { time: 0, value: callCount };
              },
              getState() {
                return { count: callCount };
              },
            }),
          },
        ],
      },
      warmUp: [
        { time: 0, open: 100, high: 105, low: 95, close: 102, volume: 100 },
        { time: 60_000, open: 102, high: 108, low: 100, close: 106, volume: 150 },
      ],
    });

    // 2 warm-up candles should have been processed
    expect(callCount).toBe(2);
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const session1 = createTradingSession({
        intervalMs: INTERVAL,
        pipeline: {
          indicators: [{ name: "rsi", create: () => createMockIndicator(50, 0) }],
        },
      });

      session1.onTrade(trade(0, 100));
      session1.onTrade(trade(30_000, 110));

      const state = JSON.parse(JSON.stringify(session1.getState()));
      expect(state.aggregatorState).toBeDefined();
      expect(state.pipelineState).toBeDefined();
    });

    it("should skip warmUp when restoring from state", () => {
      let callCount = 0;
      const warmUpCandles = [
        { time: 0, open: 100, high: 105, low: 95, close: 102, volume: 100 },
        { time: 60_000, open: 102, high: 108, low: 100, close: 106, volume: 150 },
      ];

      const createOpts = () => ({
        intervalMs: INTERVAL,
        pipeline: {
          indicators: [
            {
              name: "counter",
              create: () => ({
                next() {
                  callCount++;
                  return { time: 0, value: callCount };
                },
                peek() {
                  return { time: 0, value: callCount };
                },
                getState() {
                  return { count: callCount };
                },
              }),
            },
          ],
        },
        warmUp: warmUpCandles,
      });

      // First session: warmUp should run
      const session1 = createTradingSession(createOpts());
      expect(callCount).toBe(2);

      const state = session1.getState();

      // Restore session: warmUp should be skipped (state already contains warmed-up data)
      callCount = 0;
      createTradingSession(createOpts(), state);
      expect(callCount).toBe(0);
    });
  });

  it("should handle e2e flow: trades → candle → entry → exit", () => {
    let rsiVal = 25;
    const session = createTradingSession({
      intervalMs: INTERVAL,
      pipeline: {
        indicators: [
          {
            name: "rsi",
            create: () => ({
              next() {
                return { time: 0, value: rsiVal };
              },
              peek() {
                return { time: 0, value: rsiVal };
              },
              getState() {
                return { val: rsiVal };
              },
            }),
          },
        ],
        entry: rsiBelow(30),
        exit: rsiAbove(70),
      },
    });

    // Period 1: RSI = 25 → entry
    session.onTrade(trade(0, 100));
    let events = session.onTrade(trade(60_000, 105));
    expect(events.some((e) => e.type === "entry")).toBe(true);
    expect(events.some((e) => e.type === "exit")).toBe(false);

    // Period 2: RSI = 75 → exit
    rsiVal = 75;
    events = session.onTrade(trade(120_000, 108));
    expect(events.some((e) => e.type === "entry")).toBe(false);
    expect(events.some((e) => e.type === "exit")).toBe(true);

    // Period 3: RSI = 50 → neither
    rsiVal = 50;
    events = session.onTrade(trade(180_000, 102));
    expect(events.some((e) => e.type === "entry")).toBe(false);
    expect(events.some((e) => e.type === "exit")).toBe(false);
  });
});
