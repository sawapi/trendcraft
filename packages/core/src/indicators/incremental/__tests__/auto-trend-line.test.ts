/**
 * Parity tests for incremental Auto Trend Line vs batch.
 *
 * Same shifted-parity property as Channel Line: live confirms swings with
 * `rightBars` delay, so the underlying slope/anchor at step `t` agree with
 * `batch[t - rightBars]`. Raw `resistance / support` cannot be compared
 * bar-by-bar across the shift because each side projects at a different
 * bar (live at the current bar, batch at iteration index); tests verify
 * "has line" parity plus standard properties.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { autoTrendLine } from "../../price/auto-trend-line";
import { createAutoTrendLine } from "../price/auto-trend-line";

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

describe("createAutoTrendLine", () => {
  const leftBars = 5;
  const rightBars = 5;
  const candles = generateCandles(400);

  it("matches batch on has-line state with rightBars shift", () => {
    const batch = autoTrendLine(candles, { leftBars, rightBars });
    const live = createAutoTrendLine({ leftBars, rightBars });
    let comparedDefined = 0;
    for (let t = 0; t < candles.length; t++) {
      const liveVal = live.next(candles[t]).value;
      const batchIdx = t - rightBars;
      if (batchIdx < 0) continue;
      const batchVal = batch[batchIdx].value;
      // Both sides should agree on whether each line is defined at this
      // aligned point. Raw values diverge because of the projection-bar gap.
      expect(liveVal.resistance === null).toBe(batchVal.resistance === null);
      expect(liveVal.support === null).toBe(batchVal.support === null);
      if (liveVal.resistance !== null && liveVal.support !== null) comparedDefined++;
    }
    expect(comparedDefined).toBeGreaterThan(50);
  });

  it("eventually defines both resistance and support", () => {
    const live = createAutoTrendLine({ leftBars, rightBars });
    let sawRes = false;
    let sawSup = false;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.resistance !== null) sawRes = true;
      if (value.support !== null) sawSup = true;
      if (sawRes && sawSup) break;
    }
    expect(sawRes).toBe(true);
    expect(sawSup).toBe(true);
  });

  it("restores from snapshot without drift", () => {
    const a = createAutoTrendLine({ leftBars, rightBars });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createAutoTrendLine({ leftBars, rightBars }, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.resistance).toBe(va.resistance);
      expect(vb.support).toBe(va.support);
    }
  });

  it("preserves custom config when restored without re-passing options", () => {
    const customLeft = 7;
    const customRight = 4;
    const a = createAutoTrendLine({ leftBars: customLeft, rightBars: customRight });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createAutoTrendLine(undefined, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.resistance).toBe(va.resistance);
      expect(vb.support).toBe(va.support);
    }
    const stateB = b.getState();
    expect(stateB.leftBars).toBe(customLeft);
    expect(stateB.rightBars).toBe(customRight);
  });

  it("peek does not mutate state", () => {
    const live = createAutoTrendLine({ leftBars, rightBars });
    for (let i = 0; i < 80; i++) live.next(candles[i]);
    const before = JSON.stringify(live.getState());
    live.peek(candles[80]);
    expect(JSON.stringify(live.getState())).toBe(before);
  });

  it("throws on invalid options", () => {
    expect(() => createAutoTrendLine({ leftBars: 0 })).toThrow();
    expect(() => createAutoTrendLine({ rightBars: 0 })).toThrow();
  });

  it("warms up via WarmUpOptions.warmUp", () => {
    const warmUp = candles.slice(0, 80);
    const live = createAutoTrendLine({ leftBars, rightBars }, { warmUp });
    expect(live.count).toBe(80);
    const ref = createAutoTrendLine({ leftBars, rightBars });
    for (const c of warmUp) ref.next(c);
    expect(JSON.stringify(live.getState())).toBe(JSON.stringify(ref.getState()));
  });
});
