import { describe, expect, it } from "vitest";
import type { DataPoint } from "../core/types";
import { introspect } from "../integration/series-introspector";

describe("introspect", () => {
  it("detects number series and defaults to sub pane", () => {
    const data: DataPoint<number>[] = [
      { time: 1, value: 42 },
      { time: 2, value: 43 },
    ];
    const result = introspect(data);
    expect(result.seriesType).toBe("line");
    expect(result.pane).toBe("sub");
  });

  it("reads __meta overlay=true as main pane", () => {
    const data: DataPoint<number>[] = [
      { time: 1, value: 100 },
      { time: 2, value: 101 },
    ];
    (data as unknown as { __meta: { overlay: boolean; label: string } }).__meta = {
      overlay: true,
      label: "SMA 20",
    };
    const result = introspect(data);
    expect(result.pane).toBe("main");
    expect(result.config.label).toBe("SMA 20");
  });

  it("reads __meta overlay=false as sub pane", () => {
    const data: DataPoint<number>[] = [{ time: 1, value: 50 }];
    (
      data as unknown as {
        __meta: {
          overlay: boolean;
          label: string;
          yRange: [number, number];
          referenceLines: number[];
        };
      }
    ).__meta = {
      overlay: false,
      label: "RSI 14",
      yRange: [0, 100],
      referenceLines: [30, 70],
    };
    const result = introspect(data);
    expect(result.pane).toBe("sub");
    expect(result.yRange).toEqual([0, 100]);
    expect(result.referenceLines).toEqual([30, 70]);
  });

  it("user config overrides __meta", () => {
    const data: DataPoint<number>[] = [{ time: 1, value: 100 }];
    (data as unknown as { __meta: { overlay: boolean; label: string } }).__meta = {
      overlay: false,
      label: "RSI",
    };
    const result = introspect(data, { pane: "main", label: "Custom" });
    expect(result.pane).toBe("main");
    expect(result.config.label).toBe("Custom");
  });

  it("detects band shape without __meta", () => {
    const data: DataPoint<{ upper: number; middle: number; lower: number }>[] = [
      { time: 1, value: { upper: 110, middle: 100, lower: 90 } },
    ];
    const result = introspect(data);
    expect(result.seriesType).toBe("band");
    expect(result.pane).toBe("main");
  });

  it("detects MACD shape without __meta", () => {
    const data: DataPoint<{ macd: number; signal: number; histogram: number }>[] = [
      { time: 1, value: { macd: 0.5, signal: 0.3, histogram: 0.2 } },
    ];
    const result = introspect(data);
    expect(result.pane).toBe("sub");
  });

  it("handles empty data gracefully", () => {
    const result = introspect([]);
    expect(result.seriesType).toBe("line");
    expect(result.pane).toBe("sub");
  });
});
