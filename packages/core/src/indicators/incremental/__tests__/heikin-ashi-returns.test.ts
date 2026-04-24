/**
 * Parity tests for the newly incremental-ized price indicators:
 * Heikin-Ashi and Returns.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { heikinAshi } from "../../price/heikin-ashi";
import { returns as returnsBatch } from "../../price/returns";
import { processAll } from "../bridge";
import { createHeikinAshi } from "../price/heikin-ashi";
import { createReturns } from "../price/returns";

function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS_PER_DAY = 86400000;
  const baseTime = new Date("2020-01-01").getTime();
  let price = 100;
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const change = (random() - 0.5) * 4;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + random() * 0.01);
    const low = Math.min(open, close) * (1 - random() * 0.01);
    candles.push({
      time: baseTime + i * MS_PER_DAY,
      open,
      high,
      low,
      close,
      volume: Math.floor(100000 + random() * 900000),
    });
    price = close;
  }
  return candles;
}

describe("createHeikinAshi", () => {
  const candles = generateCandles(100);

  it("matches batch heikinAshi value-by-value", () => {
    const batch = heikinAshi(candles);
    const incr = processAll(createHeikinAshi(), candles);
    expect(incr.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incr[i].time).toBe(batch[i].time);
      expect(incr[i].value.open).toBeCloseTo(batch[i].value.open, 10);
      expect(incr[i].value.high).toBeCloseTo(batch[i].value.high, 10);
      expect(incr[i].value.low).toBeCloseTo(batch[i].value.low, 10);
      expect(incr[i].value.close).toBeCloseTo(batch[i].value.close, 10);
      expect(incr[i].value.trend).toBe(batch[i].value.trend);
    }
  });

  it("restores from snapshot without drift", () => {
    const ha = createHeikinAshi();
    for (let i = 0; i < 50; i++) ha.next(candles[i]);
    const snap = ha.getState();
    const resumed = createHeikinAshi({}, { fromState: snap });
    const batch = heikinAshi(candles);
    for (let i = 50; i < candles.length; i++) {
      const { value } = resumed.next(candles[i]);
      expect(value.close).toBeCloseTo(batch[i].value.close, 10);
      expect(value.open).toBeCloseTo(batch[i].value.open, 10);
    }
  });

  it("peek does not advance state", () => {
    const ha = createHeikinAshi();
    for (let i = 0; i < 20; i++) ha.next(candles[i]);
    const before = ha.getState();
    const peeked = ha.peek(candles[20]);
    const after = ha.getState();
    expect(after).toEqual(before);
    const advanced = ha.next(candles[20]);
    expect(peeked.value.close).toBeCloseTo(advanced.value.close, 10);
  });
});

describe("createReturns", () => {
  const candles = generateCandles(80);

  for (const type of ["simple", "log"] as const) {
    for (const period of [1, 5]) {
      it(`matches batch returns (${type}, period=${period})`, () => {
        const batch = returnsBatch(candles, { period, type });
        const incr = processAll(createReturns({ period, type }), candles);
        expect(incr.length).toBe(batch.length);
        for (let i = 0; i < batch.length; i++) {
          expect(incr[i].time).toBe(batch[i].time);
          if (batch[i].value === null) {
            expect(incr[i].value).toBeNull();
          } else {
            expect(incr[i].value).not.toBeNull();
            expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 10);
          }
        }
      });
    }
  }

  it("throws on invalid period", () => {
    expect(() => createReturns({ period: 0 })).toThrow();
  });

  it("emits null on a zero reference price without crashing", () => {
    // Build a candle where the reference (period=1 -> previous) close is 0
    const flat: NormalizedCandle[] = [
      { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 },
      { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 },
    ];
    const incr = processAll(createReturns({ period: 1 }), flat);
    expect(incr[0].value).toBeNull();
    expect(incr[1].value).toBeNull();
  });

  it("restores from snapshot and continues correctly", () => {
    const batch = returnsBatch(candles, { period: 3, type: "simple" });
    const r = createReturns({ period: 3, type: "simple" });
    for (let i = 0; i < 40; i++) r.next(candles[i]);
    const snap = r.getState();
    const resumed = createReturns({}, { fromState: snap });
    for (let i = 40; i < candles.length; i++) {
      const { value } = resumed.next(candles[i]);
      if (batch[i].value === null) {
        expect(value).toBeNull();
      } else {
        expect(value as number).toBeCloseTo(batch[i].value as number, 10);
      }
    }
  });
});
