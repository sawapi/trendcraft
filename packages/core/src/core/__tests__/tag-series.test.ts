import { describe, expect, it } from "vitest";
import type { Series, SeriesMeta } from "../../types/candle";
import { tagSeries, withLabelParams } from "../tag-series";

describe("tagSeries", () => {
  it("attaches __meta to the series", () => {
    const data: Series<number> = [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
    ];
    const meta: SeriesMeta = { kind: "test", overlay: true, label: "Test" };
    const tagged = tagSeries(data, meta);

    expect(tagged.__meta).toEqual(meta);
    expect(tagged.__meta?.kind).toBe("test");
    expect(tagged.__meta?.label).toBe("Test");
  });

  it("leaves empty arrays un-tagged so tests using toEqual([]) keep passing", () => {
    const empty: Series<number> = [];
    const tagged = tagSeries(empty, { overlay: true, label: "X" });
    expect(tagged).toEqual([]);
    expect(tagged.__meta).toBeUndefined();
  });

  it("__meta is non-enumerable and not spread by ...array", () => {
    const data: Series<number> = [{ time: 1, value: 10 }];
    const tagged = tagSeries(data, { overlay: true, label: "X" });

    const copy = [...tagged];
    expect(copy.length).toBe(1);
    // Spreading an array does not copy custom array properties
    expect((copy as Series<number> & { __meta?: SeriesMeta }).__meta).toBeUndefined();
  });
});

describe("withLabelParams", () => {
  const base: SeriesMeta = { kind: "sma", overlay: true, label: "SMA" };

  it("appends a single param in parentheses", () => {
    expect(withLabelParams(base, [20]).label).toBe("SMA(20)");
  });

  it("joins multiple params with comma + space", () => {
    const macd: SeriesMeta = { kind: "macd", overlay: false, label: "MACD" };
    expect(withLabelParams(macd, [12, 26, 9]).label).toBe("MACD(12, 26, 9)");
  });

  it("preserves kind, overlay, and other fields", () => {
    const rsi: SeriesMeta = {
      kind: "rsi",
      overlay: false,
      label: "RSI",
      yRange: [0, 100],
      referenceLines: [30, 70],
    };
    const out = withLabelParams(rsi, [14]);
    expect(out).toEqual({
      kind: "rsi",
      overlay: false,
      label: "RSI(14)",
      yRange: [0, 100],
      referenceLines: [30, 70],
    });
  });

  it("skips null / undefined param slots", () => {
    expect(withLabelParams(base, [12, undefined, 9]).label).toBe("SMA(12, 9)");
    expect(withLabelParams(base, [null, 20]).label).toBe("SMA(20)");
  });

  it("returns the meta unchanged when no visible params", () => {
    expect(withLabelParams(base, []).label).toBe("SMA");
    expect(withLabelParams(base, [undefined, null]).label).toBe("SMA");
  });

  it("is non-mutating — original meta object is unchanged", () => {
    const original: SeriesMeta = { kind: "sma", overlay: true, label: "SMA" };
    withLabelParams(original, [20]);
    expect(original.label).toBe("SMA");
  });

  it("supports string params as well as numbers", () => {
    const vwap: SeriesMeta = { kind: "anchoredVwap", overlay: true, label: "AVWAP" };
    expect(withLabelParams(vwap, ["2024-01-01"]).label).toBe("AVWAP(2024-01-01)");
  });
});
