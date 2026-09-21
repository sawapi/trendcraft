/**
 * Degenerate inputs must yield a consistent, documented result — never a raw
 * TypeError, a sentinel that violates the indicator's own invariants, or an
 * extreme reading for a window that carries no information.
 *
 * - hmmRegimes([]) returns [] like every other indicator; fitHmm([]) throws a
 *   descriptive error instead of a TypeError from inside the fitter
 * - MFI with zero positive AND zero negative money flow (flat prices or zero
 *   volume) reads 50 (neutral), in both the batch and the incremental form
 * - volumeProfile over a zero-volume window returns a value area that spans
 *   the window and a POC inside it (val <= poc <= vah), in the single-profile
 *   and the rolling-series form
 */

import { describe, expect, it } from "vitest";
import {
  breakdownVal,
  breakoutVah,
  inValueArea,
  nearPoc,
  priceAbovePoc,
  priceBelowPoc,
} from "../../backtest/conditions/volume-anomaly-profile";
import type { NormalizedCandle } from "../../types";
import { createMfi } from "../incremental/volume/mfi";
import { fitHmm, hmmRegimes } from "../regime/hmm-regimes";
import { mfi } from "../volume/mfi";
import { volumeProfile, volumeProfileSeries } from "../volume/volume-profile";

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

function candles(n: number, at: (i: number) => Partial<NormalizedCandle>): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: T0 + i * DAY,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000,
    ...at(i),
  }));
}

describe("hmmRegimes / fitHmm on empty input", () => {
  it("hmmRegimes([]) returns an empty series", () => {
    expect(hmmRegimes([])).toEqual([]);
  });

  it("fitHmm([]) throws a descriptive error, not a TypeError from the fitter", () => {
    expect(() => fitHmm([])).toThrow(/empty/);
    expect(() => fitHmm([])).not.toThrow(TypeError);
  });
});

describe("MFI when both money flows are zero", () => {
  const period = 14;
  const flat = candles(30, () => ({}));
  const zeroVolume = candles(30, (i) => ({ close: 100 + (i % 2), volume: 0 }));
  // the last 14 bars are flat, the earlier ones move: the window turns
  // neutral only once the moving bars have left it
  const flatTail = candles(40, (i) =>
    i < 20 ? { close: 100 + (i % 3), high: 104, low: 96, volume: 500 + i } : {},
  );

  it("stimulus: the fixtures really produce zero flow on both sides", () => {
    // typical price constant -> neither branch; volume 0 -> raw money flow 0
    const tp = (c: NormalizedCandle) => (c.high + c.low + c.close) / 3;
    expect(new Set(flat.map(tp)).size).toBe(1);
    expect(zeroVolume.every((c) => c.volume === 0)).toBe(true);
    expect(new Set(flatTail.slice(20).map(tp)).size).toBe(1);
  });

  it("flat prices read 50 (neutral), not 100", () => {
    const values = mfi(flat, { period })
      .slice(period)
      .map((s) => s.value);
    expect(values).toEqual(Array(30 - period).fill(50));
  });

  it("zero volume reads 50 (neutral), not 100", () => {
    const values = mfi(zeroVolume, { period })
      .slice(period)
      .map((s) => s.value);
    expect(values).toEqual(Array(30 - period).fill(50));
  });

  it("becomes neutral exactly when the last moving bar leaves the window", () => {
    const values = mfi(flatTail, { period }).map((s) => s.value);
    // bar 33 is the last window still containing bar 20's comparison (19 -> 20);
    // from bar 34 on every comparison inside the window is flat
    expect(values[33]).not.toBe(50);
    expect(values.slice(34)).toEqual(Array(6).fill(50));
  });

  it("the incremental form agrees bar by bar on all three fixtures", () => {
    for (const fixture of [flat, zeroVolume, flatTail]) {
      const batch = mfi(fixture, { period }).map((s) => s.value);
      const inc = createMfi({ period });
      const streamed = fixture.map((c) => inc.next(c).value);
      expect(streamed).toEqual(batch);
    }
  });

  it("windows with flow on one side only keep their 0 / 100 readings", () => {
    const rising = candles(30, (i) => ({ close: 100 + i, high: 101 + i, low: 99 + i }));
    const falling = candles(30, (i) => ({ close: 200 - i, high: 201 - i, low: 199 - i }));
    expect(mfi(rising, { period }).at(-1)?.value).toBe(100);
    expect(mfi(falling, { period }).at(-1)?.value).toBe(0);
  });
});

describe("volumeProfile over a zero-volume window", () => {
  const zeroVolume = candles(30, (i) => ({
    close: 100 + Math.sin(i) * 5,
    high: 102 + Math.sin(i) * 5,
    low: 98 + Math.sin(i) * 5,
    volume: 0,
  }));

  it("stimulus: the window has a real price range and no volume", () => {
    expect(zeroVolume.every((c) => c.volume === 0)).toBe(true);
    const hi = Math.max(...zeroVolume.map((c) => c.high));
    const lo = Math.min(...zeroVolume.map((c) => c.low));
    expect(hi - lo).toBeGreaterThan(5);
  });

  it("returns a value area spanning the window with the POC inside it", () => {
    const p = volumeProfile(zeroVolume, { levels: 24 });
    expect(p.val).toBe(p.periodLow);
    expect(p.vah).toBe(p.periodHigh);
    expect(p.poc).toBeGreaterThanOrEqual(p.val);
    expect(p.poc).toBeLessThanOrEqual(p.vah);
    expect(p.poc).toBeCloseTo((p.periodLow + p.periodHigh) / 2, 10);
    expect(p.levels.every((l) => l.volume === 0 && l.volumePercent === 0)).toBe(true);
  });

  it("holds val <= poc <= vah within [periodLow, periodHigh] for every rolling window", () => {
    const series = volumeProfileSeries(zeroVolume, { period: 10, levels: 24 });
    let checked = 0;
    for (const s of series) {
      if (!s.value) continue;
      checked++;
      expect(s.value.val).toBe(s.value.periodLow);
      expect(s.value.vah).toBe(s.value.periodHigh);
      expect(s.value.poc).toBeGreaterThanOrEqual(s.value.val);
      expect(s.value.poc).toBeLessThanOrEqual(s.value.vah);
    }
    expect(checked).toBe(21);
  });

  it("value-area and POC conditions do not fire on a window without volume", () => {
    const conditions = [
      inValueArea(10),
      nearPoc(0.5, 10),
      priceAbovePoc(10),
      priceBelowPoc(10),
      breakoutVah(10),
      breakdownVal(10),
    ];
    const fired = conditions.map(() => 0);
    for (let i = 10; i < zeroVolume.length; i++) {
      conditions.forEach((cond, k) => {
        if (cond.evaluate({}, zeroVolume[i], i, zeroVolume)) fired[k]++;
      });
    }
    expect(fired).toEqual([0, 0, 0, 0, 0, 0]);
    // stimulus: the same conditions do fire once the window carries volume
    const traded = zeroVolume.map((c) => ({ ...c, volume: 1000 }));
    let inArea = 0;
    for (let i = 10; i < traded.length; i++) {
      if (inValueArea(10).evaluate({}, traded[i], i, traded)) inArea++;
    }
    expect(inArea).toBeGreaterThan(0);
  });

  it("a window whose volume lands in no price bin still counts as traded (conditions unchanged)", () => {
    // Flat bars alternating 100 / 110 with volume only on the 110 bars: the
    // 110 bar sits exactly at periodHigh and the bin allocation assigns it no
    // level, so every bin reads 0 while the window's own volume is 1000.
    const px = [100, 110, 100, 110];
    const vol = [0, 1000, 0, 1000];
    const bars: NormalizedCandle[] = px.map((p, i) => ({
      time: T0 + i * DAY,
      open: p,
      high: p,
      low: p,
      close: p,
      volume: vol[i],
    }));
    const profiles = volumeProfileSeries(bars, { period: 2 });
    for (let i = 1; i < bars.length; i++) {
      const profile = profiles[i].value;
      if (!profile) throw new Error("profile expected");
      expect(profile.levels.every((l) => l.volume === 0)).toBe(true); // stimulus: the allocation gap
      // the conditions must read the profile exactly as they would without the guard
      expect(priceAbovePoc(2).evaluate({}, bars[i], i, bars)).toBe(bars[i].close > profile.poc);
      expect(inValueArea(2).evaluate({}, bars[i], i, bars)).toBe(
        bars[i].close >= profile.val && bars[i].close <= profile.vah,
      );
    }
    // and at least one of them actually fires on this window
    expect(priceAbovePoc(2).evaluate({}, bars[3], 3, bars)).toBe(true);
  });

  it("both entry points require an integer number of levels, at least 2, with one error", () => {
    for (const levels of [0, 1, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => volumeProfile(zeroVolume, { levels })).toThrow(/at least 2 levels/);
      expect(() => volumeProfileSeries(zeroVolume, { period: 10, levels })).toThrow(
        /at least 2 levels/,
      );
    }
    expect(() => volumeProfileSeries(zeroVolume, { period: 10, levels: 2 })).not.toThrow();
  });

  it("a window with volume on a single bar is unchanged (POC on that bar, value area around it)", () => {
    const oneBar = candles(30, (i) => ({
      volume: i === 7 ? 500 : 0,
      close: 100 + Math.sin(i) * 5,
      high: 102 + Math.sin(i) * 5,
      low: 98 + Math.sin(i) * 5,
    }));
    const p = volumeProfile(oneBar, { levels: 24 });
    expect(p.val).toBeLessThanOrEqual(p.poc);
    expect(p.poc).toBeLessThanOrEqual(p.vah);
    expect(p.val).toBeGreaterThanOrEqual(oneBar[7].low);
    expect(p.vah).toBeLessThanOrEqual(oneBar[7].high);
  });
});
