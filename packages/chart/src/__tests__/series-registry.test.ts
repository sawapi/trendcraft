import { describe, expect, it } from "vitest";
import { SeriesRegistry } from "../core/series-registry";
import type { DataPoint } from "../core/types";

describe("SeriesRegistry", () => {
  const registry = new SeriesRegistry();

  it("detects number series as line", () => {
    const data: DataPoint<number>[] = [
      { time: 1, value: 100 },
      { time: 2, value: 101 },
    ];
    const rule = registry.detect(data);
    expect(rule).not.toBeNull();
    expect(rule!.name).toBe("number");
    expect(rule!.seriesType).toBe("line");
  });

  it("detects band shape (BB, KC, Donchian)", () => {
    const data: DataPoint<{ upper: number; middle: number; lower: number }>[] = [
      { time: 1, value: { upper: 110, middle: 100, lower: 90 } },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("band");
    expect(rule!.seriesType).toBe("band");
    expect(rule!.defaultPane).toBe("main");
  });

  it("detects MACD shape", () => {
    const data: DataPoint<{ macd: number; signal: number; histogram: number }>[] = [
      { time: 1, value: { macd: 0.5, signal: 0.3, histogram: 0.2 } },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("macd");
    expect(rule!.defaultPane).toBe("new");
  });

  it("detects Ichimoku shape", () => {
    const data: DataPoint<{
      tenkan: number;
      kijun: number;
      senkouA: number;
      senkouB: number;
      chikou: number;
    }>[] = [{ time: 1, value: { tenkan: 100, kijun: 99, senkouA: 101, senkouB: 98, chikou: 100 } }];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("ichimoku");
    expect(rule!.seriesType).toBe("cloud");
  });

  it("detects DMI shape", () => {
    const data: DataPoint<{ adx: number; plusDi: number; minusDi: number }>[] = [
      { time: 1, value: { adx: 25, plusDi: 30, minusDi: 15 } },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("dmi");
  });

  it("detects oscillator shape (Stochastics)", () => {
    const data: DataPoint<{ k: number; d: number }>[] = [{ time: 1, value: { k: 80, d: 75 } }];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("oscillator");
  });

  it("detects Supertrend shape", () => {
    const data: DataPoint<{ upperBand: number; lowerBand: number; trend: number }>[] = [
      { time: 1, value: { upperBand: 105, lowerBand: 95, trend: 1 } },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("supertrend");
    expect(rule!.defaultPane).toBe("main");
  });

  it("detects Parabolic SAR shape", () => {
    const data: DataPoint<{ sar: number; trend: number }>[] = [
      { time: 1, value: { sar: 100, trend: 1 } },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("parabolicSar");
  });

  it("skips null values when detecting", () => {
    const data: DataPoint<number | null>[] = [
      { time: 1, value: null },
      { time: 2, value: null },
      { time: 3, value: 42 },
    ];
    const rule = registry.detect(data);
    expect(rule!.name).toBe("number");
  });

  it("returns null for empty data", () => {
    expect(registry.detect([])).toBeNull();
  });

  it("decomposes MACD values into channels", () => {
    const data: DataPoint<{ macd: number; signal: number; histogram: number }>[] = [
      { time: 1, value: { macd: 0.5, signal: 0.3, histogram: 0.2 } },
      { time: 2, value: { macd: 0.7, signal: 0.4, histogram: 0.3 } },
    ];
    const rule = registry.detect(data)!;
    const channels = registry.decomposeAll(data, rule);

    expect(channels.get("macd")).toEqual([0.5, 0.7]);
    expect(channels.get("signal")).toEqual([0.3, 0.4]);
    expect(channels.get("histogram")).toEqual([0.2, 0.3]);
  });

  it("allows adding custom rules", () => {
    const customRegistry = new SeriesRegistry();
    customRegistry.addRule({
      name: "myCustom",
      test: (v) => typeof v === "object" && v !== null && "custom" in v,
      seriesType: "area",
      defaultPane: "new",
      decompose: (v) => ({ custom: (v as { custom: number }).custom }),
    });

    const data: DataPoint<{ custom: number }>[] = [{ time: 1, value: { custom: 42 } }];
    const rule = customRegistry.detect(data);
    expect(rule!.name).toBe("myCustom");
    expect(rule!.seriesType).toBe("area");
  });
});
