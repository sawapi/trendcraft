import { describe, expect, it } from "vitest";
import { doubleBottom } from "../../../signals/patterns/double-top-bottom";
import type { NormalizedCandle } from "../../../types";
import { alwaysFalse } from "../../conditions";
import { runBacktest } from "../../engine";
import {
  patternConfidenceAbove,
  patternConfirmed,
  patternDetected,
  patternWithinBars,
} from "../patterns";

const DAY = 86_400_000;

function candle(i: number, close: number, volume = 1000): NormalizedCandle {
  return {
    time: DAY * (i + 1),
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume,
  };
}

function timeAt(index: number): number {
  return DAY * (index + 1);
}

/**
 * Deterministic double bottom (swingLookback = 5):
 * - first trough at i10 (90), middle peak at i16 (101, the neckline)
 * - second trough at i22 (90.2) — a swing low only identifiable at i27
 * - neckline breakout at i28 (close 103 > 101)
 *
 * So the formation is knowable at i27 and the confirmation at i28. A causal
 * backtest with next-bar-open fills must not enter before i28 (detected) /
 * i29 (confirmed).
 */
function doubleBottomCandles(): NormalizedCandle[] {
  const closes: number[] = [];
  for (let i = 0; i < 10; i++) closes.push(110 - i * 2); // i0..i9 decline
  closes.push(90); // i10 first trough
  for (let i = 1; i <= 5; i++) closes.push(90 + i * 2); // i11..i15 rally
  closes.push(101); // i16 middle peak (neckline)
  closes.push(99, 97, 95, 93, 91); // i17..i21 decline
  closes.push(90.2); // i22 second trough
  closes.push(92, 93.5, 95, 96.5, 98); // i23..i27 rally below neckline
  closes.push(103); // i28 breakout
  closes.push(104, 105, 106, 107, 108, 109); // i29..i34 continuation
  return closes.map((c, i) => candle(i, c, i === 28 ? 3000 : 1000));
}

function evaluateAt(
  condition: ReturnType<typeof patternDetected>,
  candles: NormalizedCandle[],
  index: number,
  indicators: Record<string, unknown> = {},
): boolean {
  return condition.evaluate(indicators, candles[index], index, candles);
}

describe("pattern signal causal timestamps", () => {
  const candles = doubleBottomCandles();

  it("anchors time at the pivot but exposes when the pattern is actually knowable", () => {
    const patterns = doubleBottom(candles);
    expect(patterns).toHaveLength(1);
    const p = patterns[0];
    expect(p.confirmed).toBe(true);
    expect(p.time).toBe(timeAt(22)); // second trough pivot
    expect(p.detectableTime).toBe(timeAt(27)); // pivot + swingLookback
    expect(p.confirmTime).toBe(timeAt(28)); // neckline breakout bar
  });

  it("matches what a bar-by-bar (causal) rerun of the detector can see", () => {
    // One bar before detectableTime: the second trough is not yet a swing low
    expect(doubleBottom(candles.slice(0, 27))).toHaveLength(0);
    // At detectableTime: formation knowable, breakout not yet
    const atDetectable = doubleBottom(candles.slice(0, 28));
    expect(atDetectable).toHaveLength(1);
    expect(atDetectable[0].confirmed).toBe(false);
    expect(atDetectable[0].confirmTime).toBeUndefined();
    // At confirmTime: breakout knowable
    const atConfirm = doubleBottom(candles.slice(0, 29));
    expect(atConfirm).toHaveLength(1);
    expect(atConfirm[0].confirmed).toBe(true);
  });

  it("leaves confirmTime unset for unconfirmed patterns", () => {
    // Cut the data before the breakout: pattern forms but never confirms
    const unconfirmed = doubleBottom(candles.slice(0, 28));
    expect(unconfirmed[0].confirmTime).toBeUndefined();
  });
});

describe("pattern conditions fire at the causal bar, not the pivot bar", () => {
  const candles = doubleBottomCandles();

  it("patternDetected fires only when the formation becomes knowable", () => {
    const condition = patternDetected("double_bottom");
    const indicators: Record<string, unknown> = {};
    const firingBars: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (evaluateAt(condition, candles, i, indicators)) firingBars.push(i);
    }
    expect(firingBars).toEqual([27]);
  });

  it("patternConfirmed fires only when the breakout becomes knowable", () => {
    const condition = patternConfirmed("double_bottom");
    const indicators: Record<string, unknown> = {};
    const firingBars: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (evaluateAt(condition, candles, i, indicators)) firingBars.push(i);
    }
    expect(firingBars).toEqual([28]);
  });

  it("patternConfidenceAbove gates confirmed-pattern confidence on the breakout bar", () => {
    // The pattern's confidence folds in breakout + breakout-volume information,
    // so it must not be visible at the pivot bar.
    const condition = patternConfidenceAbove("double_bottom", 50);
    const indicators: Record<string, unknown> = {};
    const firingBars: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (evaluateAt(condition, candles, i, indicators)) firingBars.push(i);
    }
    expect(firingBars).toEqual([28]);
  });

  it("patternWithinBars looks back over actionable bars", () => {
    const condition = patternWithinBars("double_bottom", 3, { confirmedOnly: true });
    const indicators: Record<string, unknown> = {};
    // Window [i-3, i] must contain the confirm bar i28
    expect(evaluateAt(condition, candles, 27, indicators)).toBe(false);
    expect(evaluateAt(condition, candles, 28, indicators)).toBe(true);
    expect(evaluateAt(condition, candles, 31, indicators)).toBe(true);
    expect(evaluateAt(condition, candles, 32, indicators)).toBe(false);
  });
});

describe("backtest entries carry no pattern look-ahead", () => {
  const candles = doubleBottomCandles();

  it("patternConfirmed entry fills after the breakout is knowable", () => {
    const result = runBacktest(candles, patternConfirmed("double_bottom"), alwaysFalse(), {
      capital: 1_000_000,
    });
    expect(result.trades).toHaveLength(1);
    // Condition fires at i28 (breakout bar); next-bar-open fill = i29.
    // Before the fix the condition fired at the second-trough pivot (i22)
    // and the backtest bought the exact bottom with future knowledge.
    expect(result.trades[0].entryTime).toBe(timeAt(29));
    expect(result.trades[0].entryPrice).toBe(104);
  });

  it("patternDetected entry fills after the formation is knowable", () => {
    const result = runBacktest(candles, patternDetected("double_bottom"), alwaysFalse(), {
      capital: 1_000_000,
    });
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryTime).toBe(timeAt(28));
  });
});
