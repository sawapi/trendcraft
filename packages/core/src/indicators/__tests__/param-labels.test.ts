/**
 * Indicators that returned an untagged series made a chart fall back to the
 * preset's fixed label: two Highest presets with different periods both read
 * "Highest", and anything reading `__meta.label` got nothing. Each now tags
 * its output, with the parameters in the label like SMA(20). Fixed labels
 * such as "HiLo" or "StdDev" gain their parameters the same way.
 */

import { describe, expect, it } from "vitest";
import {
  atrPercentSeries,
  cumulativeReturns,
  ewmaVolatility,
  highest,
  indicatorPresets,
  lowest,
  medianPrice,
  roofingFilter,
  superSmoother,
  typicalPrice,
  volumeMa,
  weightedClose,
  zigzag,
} from "../../index";
import type { NormalizedCandle, Series } from "../../types";

const DAY = 86_400_000;
const candles: NormalizedCandle[] = Array.from({ length: 200 }, (_, i) => {
  const close = 100 + 10 * Math.sin(i / 7) + i * 0.05;
  return {
    time: Date.UTC(2024, 0, 1) + i * DAY,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i,
  };
});

const label = (series: Series<unknown>) =>
  (series as { __meta?: { label?: string } }).__meta?.label;

const presetCompute = (id: string) => {
  const compute = indicatorPresets[id]?.compute;
  if (!compute) throw new Error(`no compute for preset ${id}`);
  return compute;
};

describe("indicator labels carry their parameters", () => {
  it.each([
    ["highest", () => highest(candles, 20), "Highest(20)"],
    ["lowest", () => lowest(candles, 50), "Lowest(50)"],
    ["volumeMa", () => volumeMa(candles, { period: 20 }), "Vol MA(20)"],
    ["superSmoother", () => superSmoother(candles, { period: 12 }), "SuperSmoother(12)"],
    ["roofingFilter", () => roofingFilter(candles), "Roofing(48, 10)"],
    ["atrPercentSeries", () => atrPercentSeries(candles, 14), "ATR%(14)"],
    ["zigzag", () => zigzag(candles), "Zigzag(5%)"],
    [
      "zigzag (ATR)",
      () => zigzag(candles, { useAtr: true, atrMultiplier: 3 }),
      "Zigzag(ATR, 14, 3)",
    ],
    ["cumulativeReturns", () => cumulativeReturns(candles), "Cum. Returns"],
    ["cumulativeReturns (log)", () => cumulativeReturns(candles, "log"), "Cum. Returns(log)"],
    ["medianPrice", () => medianPrice(candles), "Median Price"],
    ["typicalPrice", () => typicalPrice(candles), "Typical Price"],
    ["weightedClose", () => weightedClose(candles), "Weighted Close"],
    ["ewmaVolatility", () => ewmaVolatility([0.01, -0.02, 0.015, 0.003]), "EWMA Vol(0.94)"],
  ] as const)("%s", (_name, run, expected) => {
    expect(label(run())).toBe(expected);
  });

  // The chart adds presets through compute, which can rebuild the array and
  // drop the tag (zigzag interpolates, ewmaVol moves onto candle times).
  it.each([
    ["highest", "Highest(20)"],
    ["lowest", "Lowest(20)"],
    ["volumeMa", "Vol MA(20)"],
    ["superSmoother", "SuperSmoother(10)"],
    ["roofingFilter", "Roofing(48, 10)"],
    ["atrPercent", "ATR%(14)"],
    ["zigzag", "Zigzag(5%)"],
    ["cumulativeReturns", "Cum. Returns"],
    ["medianPrice", "Median Price"],
    ["typicalPrice", "Typical Price"],
    ["weightedClose", "Weighted Close"],
    ["ewmaVol", "EWMA Vol(0.94)"],
    // Untagged until now, so the chart fell back to the preset's fixed name.
    ["adaptiveRsi", "Adaptive RSI(14, 6, 28)"],
    ["adaptiveMa", "Adaptive MA(10)"],
    ["adaptiveBollinger", "Adaptive BB(20, 2)"],
    ["adaptiveStochastics", "Adaptive Stoch(14)"],
    ["volatilityRegime", "Vol Regime(14, 100)"],
    ["linearRegression", "LinReg(20)"],
    ["heikinAshi", "Heikin-Ashi"],
    // Tagged without the parameters they take.
    ["highestLowest", "HiLo(20)"],
    ["standardDeviation", "StdDev(20)"],
    ["atrStops", "ATR Stops(14, 2, 3)"],
    ["volumeTrend", "Vol Trend(10, 10, 20)"],
    ["fractals", "Fractals(2)"],
    ["swingPoints", "Swing Points(5, 5)"],
    ["orderBlock", "Order Block(5)"],
    ["vsa", "VSA(20, 14)"],
    ["gapAnalysis", "Gap(0.5%)"],
    ["returns", "Returns(1)"],
    ["pivotPoints", "Pivot"],
  ] as const)("preset %s keeps the label through compute", (id, expected) => {
    const preset = indicatorPresets[id];
    expect(label(presetCompute(id)(candles, preset?.defaultParams ?? {}))).toBe(expected);
  });

  it("tells two presets with different parameters apart", () => {
    const a = presetCompute("highest")(candles, { period: 20 });
    const b = presetCompute("highest")(candles, { period: 50 });
    expect(label(a)).toBe("Highest(20)");
    expect(label(b)).toBe("Highest(50)");
  });

  it("names a non-default variant", () => {
    expect(label(presetCompute("returns")(candles, { period: 5, type: "log" }))).toBe(
      "Returns(5, log)",
    );
    expect(label(presetCompute("pivotPoints")(candles, { method: "fibonacci" }))).toBe(
      "Pivot(fibonacci)",
    );
    expect(label(presetCompute("standardDeviation")(candles, { period: 50 }))).toBe("StdDev(50)");
  });

  it("keeps the label when the ewmaVol preset maps the series onto candle times", () => {
    const series = presetCompute("ewmaVol")(candles, { lambda: 0.9 });
    expect(label(series)).toBe("EWMA Vol(0.9)");
    expect(series[0].time).toBe(candles[1].time);
  });
});
