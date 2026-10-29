import { describe, expect, it } from "vitest";
import {
  defineUnifiedCondition,
  unifiedAnd,
  unifiedNot,
  unifiedOr,
} from "../../conditions/unified";
import type { NormalizedCandle } from "../../types";
import {
  adxRising,
  and,
  crossOver,
  crossUnder,
  evaluateStreamingCondition,
  macdHistogramFalling,
  macdHistogramRising,
  newHigh,
  newLow,
  not,
  obvFalling,
  obvRising,
  or,
  priceDroppedAtr,
  priceGainedAtr,
  sarFlip,
  supertrendFlip,
  volatilityContracting,
  volatilityExpanding,
} from "../conditions";
import { createPipeline } from "../pipeline";
import type { IndicatorSnapshot, StreamingCondition } from "../types";

/**
 * Every built-in condition that compares with the previous bar. A peek at a
 * forming bar must not move that comparison point, and a combinator must not
 * skip a child, or the next confirmed bar is compared with the wrong values.
 */
const STATEFUL: [string, () => StreamingCondition][] = [
  ["crossOver", () => crossOver("fast", "slow")],
  ["crossUnder", () => crossUnder("fast", "slow")],
  ["adxRising", () => adxRising()],
  ["macdHistogramRising", () => macdHistogramRising()],
  ["macdHistogramFalling", () => macdHistogramFalling()],
  ["priceDroppedAtr", () => priceDroppedAtr(0.5)],
  ["priceGainedAtr", () => priceGainedAtr(0.5)],
  ["newHigh", () => newHigh()],
  ["newLow", () => newLow()],
  ["supertrendFlip", () => supertrendFlip()],
  ["sarFlip", () => sarFlip()],
  ["volatilityExpanding", () => volatilityExpanding()],
  ["volatilityContracting", () => volatilityContracting()],
  ["obvRising", () => obvRising()],
  ["obvFalling", () => obvFalling()],
];

type Bar = { snapshot: IndicatorSnapshot; candle: NormalizedCandle };

/** Deterministic pseudo-random bars covering every key the conditions read. */
function makeBars(count: number, seed: number): Bar[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let close = 100;
  return Array.from({ length: count }, (_, i) => {
    close = Math.max(1, close + (rand() - 0.5) * 6);
    const dir = rand() < 0.5 ? 1 : -1;
    return {
      candle: {
        time: Date.UTC(2024, 0, 1) + i * 86_400_000,
        open: close,
        high: close + rand() * 3,
        low: close - rand() * 3,
        close,
        volume: 1000,
      },
      snapshot: {
        fast: 100 + (rand() - 0.5) * 10,
        slow: 100 + (rand() - 0.5) * 10,
        dmi: { adx: rand() * 50 },
        macd: { histogram: (rand() - 0.5) * 2 },
        atr: 1 + rand() * 3,
        donchian: { upper: close + rand() * 4, lower: close - rand() * 4 },
        supertrend: { direction: dir },
        parabolicSar: { direction: rand() < 0.5 ? 1 : -1 },
        obv: (rand() - 0.5) * 1e6,
      },
    };
  });
}

function confirmedOnly(condition: StreamingCondition, bars: Bar[]): boolean[] {
  return bars.map((b) => evaluateStreamingCondition(condition, b.snapshot, b.candle));
}

describe("stateful streaming conditions", () => {
  const bars = makeBars(200, 7);
  // Forming-bar values that differ from the confirmed ones
  const forming = makeBars(200, 99);

  for (const [name, create] of STATEFUL) {
    it(`${name}: a peek between confirmed bars does not change the result`, () => {
      const expected = confirmedOnly(create(), bars);
      expect(expected.some(Boolean)).toBe(true); // the fixture exercises the condition

      const condition = create();
      const actual = bars.map((b, i) => {
        evaluateStreamingCondition(condition, forming[i].snapshot, forming[i].candle, {
          mode: "peek",
        });
        return evaluateStreamingCondition(condition, b.snapshot, b.candle, { mode: "next" });
      });
      expect(actual).toEqual(expected);
    });
  }

  for (const [name, create] of STATEFUL) {
    it(`${name}: and/or/not still evaluate it on bars where another child decides`, () => {
      // `gate` is false on two bars in three, so a short-circuiting `and`
      // would skip the stateful child there, and `or` would skip it on the
      // remaining third.
      const gate: StreamingCondition = (_s, c) => Math.round(c.close * 10) % 3 === 0;
      const alone = confirmedOnly(create(), bars);
      const gateValues = bars.map((b) => evaluateStreamingCondition(gate, b.snapshot, b.candle));

      expect(confirmedOnly(and(gate, create()), bars)).toEqual(
        alone.map((v, i) => gateValues[i] && v),
      );
      expect(confirmedOnly(or(gate, create()), bars)).toEqual(
        alone.map((v, i) => gateValues[i] || v),
      );
      expect(confirmedOnly(and(gate, not(create())), bars)).toEqual(
        alone.map((v, i) => gateValues[i] && !v),
      );
    });
  }
});

describe("pipeline.peek", () => {
  it("leaves the entry condition's state as it was", () => {
    const bars = makeBars(120, 3);
    const forming = makeBars(120, 42);
    // Stand-in indicator that reports the bar's prepared snapshot value
    const byTime = new Map<number, number>();
    for (const b of bars) byTime.set(b.candle.time, b.snapshot.obv as number);
    // Forming candles sit 1 ms after the confirmed ones, with their own values
    for (const f of forming) byTime.set(f.candle.time + 1, f.snapshot.obv as number);
    const options = () => ({
      indicators: [
        {
          name: "obv",
          create: () => ({
            next: (c: NormalizedCandle) => ({ value: byTime.get(c.time) ?? null }),
            peek: (c: NormalizedCandle) => ({ value: byTime.get(c.time) ?? null }),
            getState: () => null,
          }),
        },
      ],
      entry: obvRising(),
    });

    const plain = createPipeline(options());
    const expected = bars.map((b) => plain.next(b.candle).entrySignal);

    const peeked = createPipeline(options());
    const actual = bars.map((b, i) => {
      peeked.peek({ ...forming[i].candle, time: forming[i].candle.time + 1 });
      return peeked.next(b.candle).entrySignal;
    });

    expect(actual).toEqual(expected);
  });
});

describe("unified conditions", () => {
  /** A histogram cross above zero, keeping the previous value in a closure. */
  const crossUp = () =>
    defineUnifiedCondition({
      name: "crossUp",
      requires: ["h"],
      evaluate: (() => {
        let prev: number | null = null;
        return (ind, _candle, context) => {
          const h = ind.h as number;
          const crossed = prev !== null && prev <= 0 && h > 0;
          if (context?.mode !== "peek") prev = h;
          return crossed;
        };
      })(),
    });
  const candle = makeBars(1, 1)[0].candle;
  const at = (h: number) => ({ h });

  it("toStreamingCondition passes the peek context through", () => {
    const condition = crossUp().toStreamingCondition();
    evaluateStreamingCondition(condition, at(-1), candle);
    evaluateStreamingCondition(condition, at(2), candle, { mode: "peek" });
    // The confirmed -1 -> 1 cross must survive the peek in between
    expect(evaluateStreamingCondition(condition, at(1), candle)).toBe(true);
  });

  it("unifiedAnd / unifiedOr / unifiedNot evaluate every child", () => {
    // Gate true at h=-1 and h=2, false at h=1 and h=3. A short-circuiting
    // `and` skipped the cross at 1 and 3, then reported 3 -> 2 as a cross.
    const gate = defineUnifiedCondition({
      name: "gate",
      requires: ["h"],
      evaluate: (ind) => ind.h === -1 || ind.h === 2,
    });
    const run = (u: ReturnType<typeof crossUp>) => {
      const condition = u.toStreamingCondition();
      return [-1, 1, 3, 2].map((h) => evaluateStreamingCondition(condition, at(h), candle));
    };
    const cross = [false, true, false, false];
    const gateValues = [true, false, false, true];

    expect(run(unifiedAnd(gate, crossUp()))).toEqual(cross.map((c, i) => gateValues[i] && c));
    expect(run(unifiedOr(gate, crossUp()))).toEqual(cross.map((c, i) => gateValues[i] || c));
    expect(run(unifiedAnd(gate, unifiedNot(crossUp())))).toEqual(
      cross.map((c, i) => gateValues[i] && !c),
    );
  });
});
