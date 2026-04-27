import { describe, expect, it, vi } from "vitest";
import type { LiveSource } from "../integration/connect-indicators";
import { connectLivePrimitives } from "../integration/connect-live-primitives";
import type { SourceCandle } from "../integration/helpers";

// Minimal mock LiveSource — same shape as the one in connect-indicators.test.ts
// but only the bits that connectLivePrimitives uses (on / completedCandles).
function createMockLiveSource(initial: SourceCandle[] = []) {
  const completedCandles: SourceCandle[] = [...initial];
  const tickCbs: Array<
    (p: { candle: SourceCandle; snapshot: Record<string, unknown>; isNewCandle: boolean }) => void
  > = [];
  const completeCbs: Array<
    (p: { candle: SourceCandle; snapshot: Record<string, unknown> }) => void
  > = [];

  const source: LiveSource = {
    get completedCandles() {
      return completedCandles;
    },
    candle: null,
    snapshot: {},
    on: ((event: "tick" | "candleComplete", cb: (...args: unknown[]) => void) => {
      if (event === "tick") {
        tickCbs.push(cb as (typeof tickCbs)[0]);
        return () => {
          const i = tickCbs.indexOf(cb as (typeof tickCbs)[0]);
          if (i >= 0) tickCbs.splice(i, 1);
        };
      }
      completeCbs.push(cb as (typeof completeCbs)[0]);
      return () => {
        const i = completeCbs.indexOf(cb as (typeof completeCbs)[0]);
        if (i >= 0) completeCbs.splice(i, 1);
      };
    }) as LiveSource["on"],
  };

  return {
    source,
    pushCompleted(c: SourceCandle) {
      completedCandles.push(c);
    },
    emitComplete(c: SourceCandle) {
      for (const cb of [...completeCbs]) cb({ candle: c, snapshot: {} });
    },
    emitTick(c: SourceCandle) {
      for (const cb of [...tickCbs]) cb({ candle: c, snapshot: {}, isNewCandle: false });
    },
    completeCbCount: () => completeCbs.length,
  };
}

const candle = (time: number, close = 100): SourceCandle =>
  ({ time, open: close, high: close, low: close, close, volume: 1000 }) as SourceCandle;

describe("connectLivePrimitives", () => {
  it("recomputes and updates on candleComplete", () => {
    const mock = createMockLiveSource([candle(1)]);
    const handle = { update: vi.fn() };
    const recompute = vi.fn((cs: readonly SourceCandle[]) => ({ count: cs.length }));

    connectLivePrimitives(mock.source, [{ recompute, handle }]);

    mock.pushCompleted(candle(2));
    mock.emitComplete(candle(2));

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(recompute.mock.calls[0][0]).toHaveLength(2);
    expect(handle.update).toHaveBeenCalledWith({ count: 2 });
  });

  it("handles multiple specs independently", () => {
    const mock = createMockLiveSource();
    const h1 = { update: vi.fn() };
    const h2 = { update: vi.fn() };
    const h3 = { update: vi.fn() };
    const r1 = vi.fn(() => "a");
    const r2 = vi.fn(() => "b");
    const r3 = vi.fn(() => "c");

    connectLivePrimitives(mock.source, [
      { recompute: r1, handle: h1 },
      { recompute: r2, handle: h2 },
      { recompute: r3, handle: h3 },
    ]);

    mock.emitComplete(candle(1));

    expect(h1.update).toHaveBeenCalledWith("a");
    expect(h2.update).toHaveBeenCalledWith("b");
    expect(h3.update).toHaveBeenCalledWith("c");
  });

  it("does not trigger on tick events", () => {
    const mock = createMockLiveSource();
    const handle = { update: vi.fn() };
    const recompute = vi.fn(() => null);

    connectLivePrimitives(mock.source, [{ recompute, handle }]);

    mock.emitTick(candle(1));

    expect(recompute).not.toHaveBeenCalled();
    expect(handle.update).not.toHaveBeenCalled();
  });

  it("isolates errors — one failing spec does not block others", () => {
    const mock = createMockLiveSource();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHandle = { update: vi.fn() };
    const badRecompute = vi.fn(() => {
      throw new Error("boom");
    });
    const goodRecompute = vi.fn(() => "ok");

    connectLivePrimitives(mock.source, [
      { recompute: badRecompute, handle: { update: vi.fn() }, name: "bad" },
      { recompute: goodRecompute, handle: goodHandle },
    ]);

    expect(() => mock.emitComplete(candle(1))).not.toThrow();
    expect(goodHandle.update).toHaveBeenCalledWith("ok");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("isolates errors thrown by handle.update", () => {
    const mock = createMockLiveSource();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHandle = { update: vi.fn() };
    const badHandle = {
      update: vi.fn(() => {
        throw new Error("update boom");
      }),
    };

    connectLivePrimitives(mock.source, [
      { recompute: () => "x", handle: badHandle },
      { recompute: () => "y", handle: goodHandle },
    ]);

    expect(() => mock.emitComplete(candle(1))).not.toThrow();
    expect(goodHandle.update).toHaveBeenCalledWith("y");
    errorSpy.mockRestore();
  });

  it("disconnect stops further updates and is idempotent", () => {
    const mock = createMockLiveSource();
    const handle = { update: vi.fn() };
    const recompute = vi.fn(() => null);

    const conn = connectLivePrimitives(mock.source, [{ recompute, handle }]);
    expect(mock.completeCbCount()).toBe(1);

    conn.disconnect();
    expect(mock.completeCbCount()).toBe(0);

    mock.emitComplete(candle(1));
    expect(recompute).not.toHaveBeenCalled();

    expect(() => conn.disconnect()).not.toThrow();
  });

  it("recomputeAll triggers all specs synchronously", () => {
    const mock = createMockLiveSource([candle(1), candle(2)]);
    const h1 = { update: vi.fn() };
    const h2 = { update: vi.fn() };

    const conn = connectLivePrimitives(mock.source, [
      { recompute: (cs) => cs.length, handle: h1 },
      { recompute: () => "fixed", handle: h2 },
    ]);

    conn.recomputeAll();

    expect(h1.update).toHaveBeenCalledWith(2);
    expect(h2.update).toHaveBeenCalledWith("fixed");
  });

  it("accepts mixed specs with different T (compile-time check)", () => {
    // Regression for codex review P1: the `specs` parameter must preserve
    // per-element generic so strongly-typed plugin handles type-check.
    const mock = createMockLiveSource();
    const numHandle: { update: (n: number) => void } = { update: vi.fn() };
    const arrHandle: { update: (a: string[]) => void } = { update: vi.fn() };
    const objHandle: { update: (o: { count: number }) => void } = { update: vi.fn() };

    // If this compiles, the public signature accepts heterogeneous specs.
    connectLivePrimitives(mock.source, [
      { recompute: () => 42, handle: numHandle },
      { recompute: () => ["a", "b"], handle: arrHandle },
      { recompute: (cs) => ({ count: cs.length }), handle: objHandle },
    ]);

    mock.emitComplete(candle(1));
    expect(numHandle.update).toHaveBeenCalledWith(42);
    expect(arrHandle.update).toHaveBeenCalledWith(["a", "b"]);
    expect(objHandle.update).toHaveBeenCalledWith({ count: 0 });
  });

  it("recomputeAll after disconnect is a no-op", () => {
    const mock = createMockLiveSource([candle(1)]);
    const handle = { update: vi.fn() };
    const conn = connectLivePrimitives(mock.source, [{ recompute: () => null, handle }]);
    conn.disconnect();
    conn.recomputeAll();
    expect(handle.update).not.toHaveBeenCalled();
  });
});
