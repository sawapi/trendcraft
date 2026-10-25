/**
 * calc_indicator must not report an object result as an empty series, and
 * its UNSUPPORTED_KIND count must match what discovery lists.
 */

import { describe, expect, it } from "vitest";
import { getSafeIndicator, listSupportedKinds } from "../dispatcher/safe-map";
import type { Candle } from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";
import { listIndicatorsHandler } from "../tools/manifest";

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

describe("calc_indicator result shape", () => {
  it("refuses a kind whose result is not a series instead of reporting it empty", () => {
    // volumeProfile returns one profile object; it used to come back as
    // { count: 0, series: [] } with no error.
    expect(() =>
      calcIndicatorHandler({ kind: "volumeProfile", candles: makeCandles(120) }),
    ).toThrow(/^UNSUPPORTED_KIND: "volumeProfile" returns a single value/);
  });

  it("never reports a successful wrapper result as an empty series", () => {
    const candles = makeCandles(300);
    for (const kind of listSupportedKinds()) {
      const raw = (getSafeIndicator(kind) as (c: Candle[]) => { ok: boolean; value?: unknown })(
        candles,
      );
      if (!raw.ok) continue;
      if (Array.isArray(raw.value)) {
        expect(calcIndicatorHandler({ kind, candles, lastN: 0 }).totalLength, kind).toBe(
          raw.value.length,
        );
      } else {
        expect(() => calcIndicatorHandler({ kind, candles }), kind).toThrow(/UNSUPPORTED_KIND/);
      }
    }
  });

  it("counts the kinds list_indicators({ calcSupported: true }) actually lists", () => {
    const listed = listIndicatorsHandler({ calcSupported: true }).length;
    expect(() => calcIndicatorHandler({ kind: "noSuchKind", candles: makeCandles(10) })).toThrow(
      new RegExp(`discover the ${listed} computable kinds it lists`),
    );
  });
});
