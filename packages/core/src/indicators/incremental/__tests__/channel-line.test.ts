/**
 * Parity tests for incremental Channel Line vs batch.
 *
 * Batch uses look-ahead via batch `swingPoints`, while live confirms swings
 * with `rightBars` delay. Live's channel parameters (direction, slope,
 * anchor, offset) at step `t` agree with `batch[t - rightBars]`. Raw
 * `upper / lower / middle` cannot be compared bar-by-bar across the shift
 * because each side projects at a different bar (live at the current bar,
 * batch at its own iteration index); tests verify direction parity plus
 * standard snapshot / peek / warmup properties.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { channelLine } from "../../price/channel-line";
import { createChannelLine } from "../price/channel-line";

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

describe("createChannelLine", () => {
  const leftBars = 5;
  const rightBars = 5;
  const candles = generateCandles(400);

  it("matches batch direction with rightBars shift once channel is defined", () => {
    const batch = channelLine(candles, { leftBars, rightBars });
    const live = createChannelLine({ leftBars, rightBars });
    let comparedDefined = 0;
    for (let t = 0; t < candles.length; t++) {
      const liveVal = live.next(candles[t]).value;
      const batchIdx = t - rightBars;
      if (batchIdx < 0) continue;
      const batchVal = batch[batchIdx].value;
      expect(liveVal.direction).toBe(batchVal.direction);
      if (liveVal.direction !== null) {
        // Both sides should report a defined channel; live also emits
        // upper/lower/middle but they project at different bars from batch
        // so we only check structural consistency here.
        expect(liveVal.upper).not.toBeNull();
        expect(liveVal.lower).not.toBeNull();
        expect(liveVal.middle).not.toBeNull();
        expect(liveVal.upper).toBeGreaterThanOrEqual(liveVal.lower as number);
        comparedDefined++;
      }
    }
    expect(comparedDefined).toBeGreaterThan(50);
  });

  it("eventually defines a channel", () => {
    const live = createChannelLine({ leftBars, rightBars });
    let saw = false;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.direction !== null) {
        saw = true;
        expect(value.upper).not.toBeNull();
        expect(value.lower).not.toBeNull();
        expect(value.middle).toBe(((value.upper as number) + (value.lower as number)) / 2);
        break;
      }
    }
    expect(saw).toBe(true);
  });

  it("restores from snapshot without drift", () => {
    const a = createChannelLine({ leftBars, rightBars });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createChannelLine({ leftBars, rightBars }, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.direction).toBe(va.direction);
      expect(vb.upper).toBe(va.upper);
      expect(vb.lower).toBe(va.lower);
      expect(vb.middle).toBe(va.middle);
    }
  });

  it("preserves custom config when restored without re-passing options", () => {
    const customLeft = 7;
    const customRight = 4;
    const a = createChannelLine({ leftBars: customLeft, rightBars: customRight });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createChannelLine(undefined, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.direction).toBe(va.direction);
      expect(vb.upper).toBe(va.upper);
      expect(vb.lower).toBe(va.lower);
    }
    const stateB = b.getState();
    expect(stateB.meta.params.leftBars).toBe(customLeft);
    expect(stateB.meta.params.rightBars).toBe(customRight);
  });

  it("peek does not mutate state", () => {
    const live = createChannelLine({ leftBars, rightBars });
    for (let i = 0; i < 80; i++) live.next(candles[i]);
    const before = JSON.stringify(live.getState());
    live.peek(candles[80]);
    expect(JSON.stringify(live.getState())).toBe(before);
  });

  it("throws on invalid options", () => {
    expect(() => createChannelLine({ leftBars: 0 })).toThrow();
    expect(() => createChannelLine({ rightBars: 0 })).toThrow();
  });

  it("warms up via WarmUpOptions.warmUp", () => {
    const warmUp = candles.slice(0, 80);
    const live = createChannelLine({ leftBars, rightBars }, { warmUp });
    expect(live.count).toBe(80);
    const ref = createChannelLine({ leftBars, rightBars });
    for (const c of warmUp) ref.next(c);
    expect(JSON.stringify(live.getState())).toBe(JSON.stringify(ref.getState()));
  });
});
