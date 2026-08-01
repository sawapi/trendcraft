/**
 * A snapshot has to mean the same thing after a trip through JSON.
 *
 * `JSON.stringify` has no syntax for `NaN`, `Infinity` or `-Infinity` — it
 * writes all three as `null` — and it drops the sign of `-0`. A resumed
 * indicator then read a `null` where a number belonged, and the arithmetic
 * that followed coerced it to `0`: the output stopped looking broken and
 * started looking like data. The state contract now carries those values
 * through a tagged encoding, so an interrupted run and an uninterrupted one
 * agree bar for bar.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { createEma, type EmaState } from "../moving-average/ema";
import {
  decodeSnapshotValue,
  deserializeIndicatorSnapshot,
  encodeSnapshotValue,
  type IndicatorSnapshot,
  makeSnapshot,
  serializeIndicatorSnapshot,
} from "../state-contract";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

function candle(i: number, close: number): NormalizedCandle {
  return {
    time: START + i * DAY,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1000,
  };
}

describe("snapshot value codec", () => {
  it("round-trips every number JSON cannot represent", () => {
    const state = {
      nan: Number.NaN,
      inf: Number.POSITIVE_INFINITY,
      negInf: Number.NEGATIVE_INFINITY,
      negZero: -0,
      zero: 0,
      ordinary: 1.5,
    };

    const restored = decodeSnapshotValue(
      JSON.parse(JSON.stringify(encodeSnapshotValue(state))),
    ) as typeof state;

    expect(Number.isNaN(restored.nan)).toBe(true);
    expect(restored.inf).toBe(Number.POSITIVE_INFINITY);
    expect(restored.negInf).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(restored.negZero, -0)).toBe(true);
    expect(Object.is(restored.zero, 0)).toBe(true);
    expect(restored.ordinary).toBe(1.5);
  });

  it("reaches values nested in objects and arrays", () => {
    const state = {
      buffer: [1, Number.NaN, 3],
      inner: { deep: { value: Number.NEGATIVE_INFINITY }, list: [{ v: Number.POSITIVE_INFINITY }] },
      count: 2,
    };

    const restored = decodeSnapshotValue(
      JSON.parse(JSON.stringify(encodeSnapshotValue(state))),
    ) as typeof state;

    expect(Number.isNaN(restored.buffer[1])).toBe(true);
    expect(restored.buffer[0]).toBe(1);
    expect(restored.inner.deep.value).toBe(Number.NEGATIVE_INFINITY);
    expect(restored.inner.list[0].v).toBe(Number.POSITIVE_INFINITY);
    expect(restored.count).toBe(2);
  });

  it("leaves the input untouched", () => {
    const state = { prev: Number.NaN, buffer: [Number.POSITIVE_INFINITY] };
    const encoded = encodeSnapshotValue(state);

    expect(Number.isNaN(state.prev)).toBe(true);
    expect(state.buffer[0]).toBe(Number.POSITIVE_INFINITY);
    expect(encoded).not.toBe(state);
  });

  it("encodes an ordinary state to the same bytes as plain JSON", () => {
    const state = { prev: 1.25, buffer: [1, 2, 3], nested: { a: -1, b: null }, done: true };
    expect(JSON.stringify(encodeSnapshotValue(state))).toBe(JSON.stringify(state));
  });

  it("refuses a malformed tag rather than reading it as data", () => {
    const cases: Array<[string, unknown]> = [
      ["unknown value", { $trendcraft: { type: "number", value: "Nope", version: 1 } }],
      ["unknown type", { $trendcraft: { type: "bigint", value: "NaN", version: 1 } }],
      ["wrong version", { $trendcraft: { type: "number", value: "NaN", version: 2 } }],
      ["non-string value", { $trendcraft: { type: "number", value: 0, version: 1 } }],
      ["tag is not an object", { $trendcraft: "NaN" }],
      [
        "extra sibling key",
        { $trendcraft: { type: "number", value: "NaN", version: 1 }, other: 1 },
      ],
      [
        "extra key inside the tag",
        { $trendcraft: { type: "number", value: "NaN", version: 1, extra: true } },
      ],
      ["missing key inside the tag", { $trendcraft: { type: "number", value: "NaN" } }],
      // A name that only exists on Object.prototype: a lookup would answer
      // with the inherited function and put it where a number belongs.
      [
        "inherited property name",
        { $trendcraft: { type: "number", value: "toString", version: 1 } },
      ],
      ["constructor", { $trendcraft: { type: "number", value: "constructor", version: 1 } }],
      ["__proto__", { $trendcraft: { type: "number", value: "__proto__", version: 1 } }],
      ["valueOf", { $trendcraft: { type: "number", value: "valueOf", version: 1 } }],
    ];
    for (const [label, value] of cases) {
      expect(() => decodeSnapshotValue(value), label).toThrow(/invalid snapshot wire format/);
    }
  });

  it("returns the same object when there is nothing to decode", () => {
    // Identity matters: `resolveResume` hands the decoded state to the
    // indicator, and resuming from an object should keep handing over that
    // object. A raw NaN is the interesting case — comparing decoded values
    // with `!==` would call it a change and rebuild the parent.
    const withRawNaN = { prev: Number.NaN, buffer: [1, Number.NaN], count: 3 };
    expect(decodeSnapshotValue(withRawNaN)).toBe(withRawNaN);
    expect(decodeSnapshotValue(withRawNaN.buffer)).toBe(withRawNaN.buffer);

    const ordinary = { prev: 1, nested: { a: [1, 2] } };
    expect(decodeSnapshotValue(ordinary)).toBe(ordinary);

    const tagged = { prev: { $trendcraft: { type: "number", value: "NaN", version: 1 } } };
    expect(decodeSnapshotValue(tagged)).not.toBe(tagged);
  });

  it("reports a circular structure instead of hanging", () => {
    const state: Record<string, unknown> = { count: 1 };
    state.self = state;
    expect(() => encodeSnapshotValue(state)).toThrow(/Maximum call stack|circular/i);
  });
});

describe("snapshot persistence paths", () => {
  /** An EMA whose recursive value has been pushed to NaN by a bad tick. */
  function poisonedEma() {
    const ema = createEma({ period: 5 });
    for (let i = 0; i < 10; i++) ema.next(candle(i, 100 + i));
    ema.next({ ...candle(10, 100), close: Number.NaN });
    return ema;
  }

  it("keeps JSON.stringify(snapshot) lossless", () => {
    const ema = poisonedEma();
    const text = JSON.stringify(ema.getState());
    expect(text).toContain("$trendcraft");

    const resumed = createEma({ period: 5 }, { fromState: JSON.parse(text) });
    const uninterrupted = ema.next(candle(11, 110)).value;
    const afterResume = resumed.next(candle(11, 110)).value;
    expect(Object.is(afterResume, uninterrupted)).toBe(true);
    expect(Number.isNaN(afterResume as number)).toBe(true);
  });

  it("survives spreading the snapshot, which keeps the same state object", () => {
    const snapshot = poisonedEma().getState();
    expect(JSON.stringify({ ...snapshot })).toContain("$trendcraft");
    expect(JSON.stringify(snapshot.state)).toContain("$trendcraft");
  });

  it("covers structuredClone through the explicit codec", () => {
    const ema = poisonedEma();
    const snapshot = ema.getState();

    // structuredClone keeps NaN natively, so resuming from the clone is fine.
    const cloned = structuredClone(snapshot);
    const fromClone = createEma({ period: 5 }, { fromState: cloned });

    // Serializing the clone needs the explicit codec: the hook is a function
    // and functions are not cloned.
    expect(JSON.stringify(cloned)).not.toContain("$trendcraft");
    const text = serializeIndicatorSnapshot(cloned);
    expect(text).toContain("$trendcraft");
    const fromText = createEma(
      { period: 5 },
      { fromState: deserializeIndicatorSnapshot<EmaState>(text) },
    );

    const uninterrupted = ema.next(candle(11, 110)).value;
    expect(Object.is(fromClone.next(candle(11, 110)).value, uninterrupted)).toBe(true);
    expect(Object.is(fromText.next(candle(11, 110)).value, uninterrupted)).toBe(true);
  });

  it("keeps a deserialized snapshot persistable", () => {
    // What comes back from the deserializer is a snapshot like any other, so
    // storing it again with plain JSON.stringify must not be the step that
    // loses the values the codec exists to keep.
    const ema = poisonedEma();
    const first = serializeIndicatorSnapshot(ema.getState());
    const restored = deserializeIndicatorSnapshot<EmaState>(first);
    expect(Number.isNaN(restored.state.prevEma as number)).toBe(true);

    const second = JSON.stringify(restored);
    expect(second).toContain("$trendcraft");
    expect(second).toBe(first);

    const resumed = createEma({ period: 5 }, { fromState: JSON.parse(second) });
    const uninterrupted = ema.next(candle(11, 110)).value;
    expect(Object.is(resumed.next(candle(11, 110)).value, uninterrupted)).toBe(true);

    // And the cycle is stable however many times it is repeated.
    const third = serializeIndicatorSnapshot(deserializeIndicatorSnapshot<EmaState>(second));
    expect(third).toBe(first);
  });

  it("leaves the runtime state a plain object of numbers", () => {
    const snapshot = poisonedEma().getState();
    expect(typeof snapshot.state.prevEma).toBe("number");
    expect(Number.isNaN(snapshot.state.prevEma as number)).toBe(true);
    expect(Object.keys(snapshot.state)).not.toContain("toJSON");
    expect(Object.prototype.propertyIsEnumerable.call(snapshot.state, "toJSON")).toBe(false);
  });

  it("serializes a healthy snapshot to the same bytes as before the codec existed", () => {
    const ema = createEma({ period: 5 });
    for (let i = 0; i < 10; i++) ema.next(candle(i, 100 + i));
    const snapshot = ema.getState();
    const plain = { meta: snapshot.meta, state: { ...snapshot.state } };
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify(plain));
  });

  it("refuses a state that already owns a toJSON", () => {
    expect(() => makeSnapshot("proto", 1, {}, { value: 1, toJSON: () => ({ value: 1 }) })).toThrow(
      /defines its own toJSON/,
    );
  });

  it("refuses a state that cannot take the hook", () => {
    expect(() => makeSnapshot("proto", 1, {}, Object.freeze({ value: 1 }))).toThrow(
      /not extensible/,
    );
  });

  it("resumes identically from the object and from its JSON", () => {
    const ema = poisonedEma();
    const snapshot: IndicatorSnapshot<unknown> = ema.getState();

    const direct = createEma({ period: 5 }, { fromState: snapshot as never });
    const viaJson = createEma(
      { period: 5 },
      { fromState: JSON.parse(JSON.stringify(snapshot)) as never },
    );

    for (let i = 11; i < 16; i++) {
      const a = direct.next(candle(i, 100 + i)).value;
      const b = viaJson.next(candle(i, 100 + i)).value;
      expect(Object.is(a, b)).toBe(true);
    }
  });
});
