/**
 * Tests for the `describeContract` DSL using minimal mock indicators
 * that implement the State Contract from scratch. This lets Phase 1
 * exercise the helper end-to-end without touching any real
 * indicator's code — that comes in Phase 2.
 *
 * Two mocks:
 *  - `mockSma`: Category Windowed (raw price buffer, reconfig allowed)
 *  - `mockEma`: Category Recursive (prev value, reconfig refused)
 */

import { describe, expect, it } from "vitest";
import type { IndicatorValue, NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { describeContract } from "./contract-helper";

// ---- Test data ----

function makeCandles(n: number): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i * 0.3) * 10 + i * 0.1;
    return {
      time: 1700000000000 + i * 86400000,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    };
  });
}

// ---- Mock SMA (Category Windowed) ----

type MockSmaParams = { period: number; source: "close" | "high" };
type MockSmaState = { buffer: number[]; count: number };

const MOCK_SMA_DEFAULTS: MockSmaParams = { period: 5, source: "close" };

function createMockSma(
  options: Partial<MockSmaParams>,
  warmUpOptions?: { fromState?: IndicatorSnapshot<MockSmaState> },
): IncrementalIndicator<number | null, IndicatorSnapshot<MockSmaState>> {
  // Explicit generics so `params` keeps the full TParams shape (not
  // `Partial<TParams>`), which would otherwise leak `undefined` into
  // every field and trip TS18048 at every use site.
  const { params, state, reconfigured } = resolveResume<MockSmaParams, MockSmaState>({
    indicator: "mockSma",
    version: 1,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: MOCK_SMA_DEFAULTS,
  });

  let buffer: number[];
  let count: number;

  if (state !== null) {
    // Carry forward latest min(snapshot.length, new period) samples.
    const carry = state.buffer.slice(-params.period);
    buffer = reconfigured ? carry : [...state.buffer];
    count = state.count;
  } else {
    buffer = [];
    count = 0;
  }

  function getSource(candle: NormalizedCandle): number {
    return params.source === "high" ? candle.high : candle.close;
  }

  return {
    next(candle: NormalizedCandle): IndicatorValue<number | null> {
      const price = getSource(candle);
      count++;
      buffer.push(price);
      if (buffer.length > params.period) buffer.shift();
      if (buffer.length < params.period) return { time: candle.time, value: null };
      const sum = buffer.reduce((acc, v) => acc + v, 0);
      return { time: candle.time, value: sum / params.period };
    },
    peek(candle: NormalizedCandle): IndicatorValue<number | null> {
      const price = getSource(candle);
      const peekLen = Math.min(buffer.length + 1, params.period);
      if (peekLen < params.period) return { time: candle.time, value: null };
      const sliceStart = buffer.length >= params.period ? 1 : 0;
      let sum = price;
      for (let i = sliceStart; i < buffer.length; i++) sum += buffer[i];
      return { time: candle.time, value: sum / params.period };
    },
    getState(): IndicatorSnapshot<MockSmaState> {
      return makeSnapshot("mockSma", 1, params, { buffer: [...buffer], count });
    },
    get count() {
      return count;
    },
    get isWarmedUp() {
      return buffer.length >= params.period;
    },
  };
}

// ---- Mock EMA (Category Recursive) ----

type MockEmaParams = { period: number; source: "close" | "high" };
type MockEmaState = { prev: number | null; count: number };

const MOCK_EMA_DEFAULTS: MockEmaParams = { period: 5, source: "close" };

function createMockEma(
  options: Partial<MockEmaParams>,
  warmUpOptions?: { fromState?: IndicatorSnapshot<MockEmaState> },
): IncrementalIndicator<number | null, IndicatorSnapshot<MockEmaState>> {
  const { params, state } = resolveResume<MockEmaParams, MockEmaState>({
    indicator: "mockEma",
    version: 1,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: MOCK_EMA_DEFAULTS,
  });

  let prev: number | null = state?.prev ?? null;
  let count: number = state?.count ?? 0;
  const multiplier = 2 / (params.period + 1);

  function getSource(candle: NormalizedCandle): number {
    return params.source === "high" ? candle.high : candle.close;
  }

  return {
    next(candle: NormalizedCandle): IndicatorValue<number | null> {
      const price = getSource(candle);
      count++;
      if (prev === null) {
        // Seed at count == period with SMA-like seed (first value).
        if (count < params.period) return { time: candle.time, value: null };
        prev = price;
        return { time: candle.time, value: prev };
      }
      prev = price * multiplier + prev * (1 - multiplier);
      return { time: candle.time, value: prev };
    },
    peek(candle: NormalizedCandle): IndicatorValue<number | null> {
      const price = getSource(candle);
      if (prev === null) {
        if (count + 1 < params.period) return { time: candle.time, value: null };
        return { time: candle.time, value: price };
      }
      return { time: candle.time, value: price * multiplier + prev * (1 - multiplier) };
    },
    getState(): IndicatorSnapshot<MockEmaState> {
      return makeSnapshot("mockEma", 1, params, { prev, count });
    },
    get count() {
      return count;
    },
    get isWarmedUp() {
      return prev !== null;
    },
  };
}

// ---- Standalone tests (smoke tests) ----

describe("mock indicators integration", () => {
  it("mockSma produces values after warmup", () => {
    const ind = createMockSma({ period: 5 });
    const candles = makeCandles(20);
    const results = candles.map((c) => ind.next(c).value);
    expect(results.slice(0, 4).every((v) => v === null)).toBe(true);
    expect(results.slice(4).every((v) => v !== null)).toBe(true);
  });

  it("mockSma carry-forward on period change preserves recent samples", () => {
    const candles = makeCandles(30);
    const ind1 = createMockSma({ period: 5 });
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const snapshot = ind1.getState();
    expect(snapshot.meta.indicator).toBe("mockSma");
    expect(snapshot.meta.version).toBe(1);
    expect(snapshot.meta.params).toMatchObject({ period: 5, source: "close" });

    // Resume with larger period: snapshot had buffer of 5 samples, new
    // period 8 needs 3 more pushes to fill. Bars 20 and 21 leave the
    // buffer at 6 and 7; bar 22 brings it to 8 and warmup completes
    // (length === period satisfies the gate).
    const ind2 = createMockSma({ period: 8 }, { fromState: snapshot });
    expect(ind2.next(candles[20]).value).toBeNull();
    expect(ind2.next(candles[21]).value).toBeNull();
    expect(ind2.next(candles[22]).value).not.toBeNull();
  });

  it("mockEma refuses period change on resume", () => {
    const candles = makeCandles(20);
    const ind1 = createMockEma({ period: 5 });
    for (let i = 0; i < 15; i++) ind1.next(candles[i]);
    expect(() => createMockEma({ period: 10 }, { fromState: ind1.getState() })).toThrow(
      /incompatible snapshot/,
    );
  });

  it("foreign snapshot throws regardless of category", () => {
    const candles = makeCandles(10);
    const sma = createMockSma({ period: 5 });
    for (let i = 0; i < 8; i++) sma.next(candles[i]);
    const smaSnap = sma.getState();

    // Try to pass an SMA snapshot to EMA factory.
    const fakeEmaSnap = {
      meta: smaSnap.meta,
      // Cast the state shape — at runtime, EMA expects `prev`.
      state: smaSnap.state as unknown as MockEmaState,
    };
    expect(() => createMockEma({}, { fromState: fakeEmaSnap })).toThrow(
      /indicator mismatch|incompatible snapshot/,
    );
  });
});

// ---- describeContract integration: Windowed (mockSma) ----

describeContract<number | null, MockSmaState>({
  name: "mockSma",
  create: (opts, warmUp) => createMockSma(opts as Partial<MockSmaParams>, warmUp),
  category: "windowed",
  version: 1,
  defaultParams: MOCK_SMA_DEFAULTS,
  reconfigParams: [{ period: 8 }, { period: 3 }],
  makeCandles,
  streamLength: 50,
});

// ---- describeContract integration: Recursive (mockEma) ----

describeContract<number | null, MockEmaState>({
  name: "mockEma",
  create: (opts, warmUp) => createMockEma(opts as Partial<MockEmaParams>, warmUp),
  category: "recursive",
  version: 1,
  defaultParams: MOCK_EMA_DEFAULTS,
  reconfigParams: [{ period: 10 }, { period: 3 }],
  makeCandles,
  streamLength: 50,
});
