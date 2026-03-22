import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  and,
  evaluateStreamingCondition,
  indicatorAbove,
  macdPositive,
  not,
  or,
  priceAbove,
  priceBelow,
  rsiAbove,
  rsiBelow,
  smaGoldenCross,
} from "../conditions";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

describe("evaluateStreamingCondition", () => {
  it("should evaluate function conditions", () => {
    const alwaysTrue = () => true;
    const alwaysFalse = () => false;
    expect(evaluateStreamingCondition(alwaysTrue, {}, candle)).toBe(true);
    expect(evaluateStreamingCondition(alwaysFalse, {}, candle)).toBe(false);
  });

  it("should evaluate preset conditions", () => {
    const condition = rsiBelow(30);
    expect(evaluateStreamingCondition(condition, { rsi: 25 }, candle)).toBe(true);
    expect(evaluateStreamingCondition(condition, { rsi: 35 }, candle)).toBe(false);
  });

  it("should evaluate AND conditions", () => {
    const condition = and(rsiBelow(30), priceAbove("sma20"));
    expect(evaluateStreamingCondition(condition, { rsi: 25, sma20: 90 }, candle)).toBe(true);
    expect(evaluateStreamingCondition(condition, { rsi: 35, sma20: 90 }, candle)).toBe(false);
    expect(evaluateStreamingCondition(condition, { rsi: 25, sma20: 110 }, candle)).toBe(false);
  });

  it("should evaluate OR conditions", () => {
    const condition = or(rsiBelow(30), rsiAbove(70));
    expect(evaluateStreamingCondition(condition, { rsi: 25 }, candle)).toBe(true);
    expect(evaluateStreamingCondition(condition, { rsi: 75 }, candle)).toBe(true);
    expect(evaluateStreamingCondition(condition, { rsi: 50 }, candle)).toBe(false);
  });

  it("should evaluate NOT conditions", () => {
    const condition = not(rsiAbove(70));
    expect(evaluateStreamingCondition(condition, { rsi: 50 }, candle)).toBe(true);
    expect(evaluateStreamingCondition(condition, { rsi: 75 }, candle)).toBe(false);
  });

  it("should evaluate nested combinators", () => {
    const condition = and(or(rsiBelow(30), rsiAbove(70)), not(priceBelow("sma200")));
    // RSI oversold + price above SMA200
    expect(evaluateStreamingCondition(condition, { rsi: 25, sma200: 90 }, candle)).toBe(true);
    // RSI neutral → false
    expect(evaluateStreamingCondition(condition, { rsi: 50, sma200: 90 }, candle)).toBe(false);
  });
});

describe("preset conditions", () => {
  it("rsiBelow", () => {
    const c = rsiBelow(30);
    expect(c.evaluate({ rsi: 25 }, candle)).toBe(true);
    expect(c.evaluate({ rsi: 35 }, candle)).toBe(false);
    expect(c.evaluate({}, candle)).toBe(false);
  });

  it("rsiAbove", () => {
    const c = rsiAbove(70);
    expect(c.evaluate({ rsi: 75 }, candle)).toBe(true);
    expect(c.evaluate({ rsi: 65 }, candle)).toBe(false);
  });

  it("rsiBelow with custom key", () => {
    const c = rsiBelow(30, "rsi14");
    expect(c.evaluate({ rsi14: 25 }, candle)).toBe(true);
    expect(c.evaluate({ rsi: 25 }, candle)).toBe(false);
  });

  it("smaGoldenCross", () => {
    const c = smaGoldenCross();
    expect(c.evaluate({ goldenCross: true }, candle)).toBe(true);
    expect(c.evaluate({ goldenCross: false }, candle)).toBe(false);
    expect(c.evaluate({}, candle)).toBe(false);
  });

  it("macdPositive", () => {
    const c = macdPositive();
    expect(c.evaluate({ macd: { histogram: 5 } }, candle)).toBe(true);
    expect(c.evaluate({ macd: { histogram: -2 } }, candle)).toBe(false);
    expect(c.evaluate({ macd: { histogram: null } }, candle)).toBe(false);
    expect(c.evaluate({}, candle)).toBe(false);
  });

  it("priceAbove", () => {
    const c = priceAbove("sma20");
    expect(c.evaluate({ sma20: 90 }, candle)).toBe(true); // close=102 > 90
    expect(c.evaluate({ sma20: 110 }, candle)).toBe(false); // close=102 < 110
  });

  it("priceBelow", () => {
    const c = priceBelow("sma20");
    expect(c.evaluate({ sma20: 110 }, candle)).toBe(true);
    expect(c.evaluate({ sma20: 90 }, candle)).toBe(false);
  });

  it("indicatorAbove", () => {
    const c = indicatorAbove("adx", 25);
    expect(c.evaluate({ adx: 30 }, candle)).toBe(true);
    expect(c.evaluate({ adx: 20 }, candle)).toBe(false);
  });
});
