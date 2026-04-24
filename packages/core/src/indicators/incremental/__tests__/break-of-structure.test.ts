/**
 * Parity tests for incremental BOS / CHoCH vs batch.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { breakOfStructure, changeOfCharacter } from "../../price/break-of-structure";
import { createBreakOfStructure, createChangeOfCharacter } from "../price/break-of-structure";

function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS = 86400000;
  const base = new Date("2020-01-01").getTime();
  let price = 100;
  let s = 31;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const change = (r() - 0.5) * 5;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + r() * 0.015);
    const low = Math.min(open, close) * (1 - r() * 0.015);
    candles.push({ time: base + i * MS, open, high, low, close, volume: 1000 });
    price = close;
  }
  return candles;
}

describe("createBreakOfStructure", () => {
  const candles = generateCandles(250);
  const period = 3;

  it("matches batch BOS value-by-value", () => {
    const batch = breakOfStructure(candles, { swingPeriod: period });
    const live = createBreakOfStructure({ swingPeriod: period });
    for (let i = 0; i < candles.length; i++) {
      const l = live.next(candles[i]).value;
      const b = batch[i].value;
      expect(l.bullishBos).toBe(b.bullishBos);
      expect(l.bearishBos).toBe(b.bearishBos);
      expect(l.trend).toBe(b.trend);
      expect(l.brokenLevel).toBe(b.brokenLevel);
      expect(l.swingHighLevel).toBe(b.swingHighLevel);
      expect(l.swingLowLevel).toBe(b.swingLowLevel);
    }
  });

  it("fires at least one bullish or bearish BOS on random data", () => {
    const live = createBreakOfStructure({ swingPeriod: period });
    let fired = false;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.bullishBos || value.bearishBos) fired = true;
    }
    expect(fired).toBe(true);
  });

  it("restores from snapshot without drift", () => {
    const a = createBreakOfStructure({ swingPeriod: period });
    for (let i = 0; i < 100; i++) a.next(candles[i]);
    const b = createBreakOfStructure({ swingPeriod: period }, { fromState: a.getState() });
    for (let i = 100; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb).toEqual(va);
    }
  });

  it("peek does not mutate state", () => {
    const bos = createBreakOfStructure({ swingPeriod: period });
    for (let i = 0; i < 50; i++) bos.next(candles[i]);
    const before = JSON.stringify(bos.getState());
    bos.peek(candles[50]);
    expect(JSON.stringify(bos.getState())).toBe(before);
  });

  it("throws on invalid swingPeriod", () => {
    expect(() => createBreakOfStructure({ swingPeriod: 0 })).toThrow();
  });
});

describe("createChangeOfCharacter", () => {
  const candles = generateCandles(250);
  const period = 3;

  it("matches batch CHoCH value-by-value", () => {
    const batch = changeOfCharacter(candles, { swingPeriod: period });
    const live = createChangeOfCharacter({ swingPeriod: period });
    for (let i = 0; i < candles.length; i++) {
      const l = live.next(candles[i]).value;
      const b = batch[i].value;
      expect(l.bullishBos).toBe(b.bullishBos);
      expect(l.bearishBos).toBe(b.bearishBos);
      expect(l.trend).toBe(b.trend);
      expect(l.brokenLevel).toBe(b.brokenLevel);
    }
  });

  it("snapshot resume is stable", () => {
    const a = createChangeOfCharacter({ swingPeriod: period });
    for (let i = 0; i < 120; i++) a.next(candles[i]);
    const b = createChangeOfCharacter({ swingPeriod: period }, { fromState: a.getState() });
    for (let i = 120; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.bullishBos).toBe(va.bullishBos);
      expect(vb.bearishBos).toBe(va.bearishBos);
      expect(vb.trend).toBe(va.trend);
    }
  });
});
