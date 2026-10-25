/**
 * Object params that the manifest's paramHints advertise must be usable
 * through calc_indicator.
 */

import { describe, expect, it } from "vitest";
import type { Candle } from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";

const HOUR = 3_600_000;

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i / 4) * 5 + i * 0.1;
    return {
      time: Date.UTC(2024, 0, 2, 14) + i * HOUR,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i * 10,
    };
  });
}

describe("manifest-advertised object params", () => {
  it("accepts vwap's session, including its breaks", () => {
    const session = {
      name: "NY",
      startHour: 14,
      startMinute: 30,
      endHour: 21,
      endMinute: 0,
      breaks: [{ startHour: 17, startMinute: 0, endHour: 17, endMinute: 30 }],
    };
    const result = calcIndicatorHandler({
      kind: "vwap",
      candles: makeCandles(120),
      params: { session },
      lastN: 0,
    });
    expect(result.totalLength).toBe(120);
  });

  it("accepts volatilityRegime's thresholds", () => {
    const result = calcIndicatorHandler({
      kind: "volatilityRegime",
      candles: makeCandles(200),
      params: { thresholds: { low: 20, high: 80, extreme: 95 } },
      lastN: 0,
    });
    expect(result.totalLength).toBe(200);
  });
});
