/**
 * Supertrend draws nothing while it has no direction.
 *
 * Supertrend reports `direction: 0` after its ATR warm-up until price first
 * breaks a band, with the bands already defined. Drawing that stretch as a
 * downtrend (the upper band, in the bearish colour) would show a trend the
 * indicator does not claim, and the first upward break would look like a
 * reversal.
 */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, DataPoint } from "../core/types";
import { DARK_THEME } from "../core/types/theme";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const N = 30;
const UNDIRECTED = 12;

function series(): { s: InternalSeries; candles: CandleData[] } {
  const candles: CandleData[] = Array.from({ length: N }, (_, i) => ({
    time: i,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000,
  }));
  const data: DataPoint<unknown>[] = candles.map((c, i) => ({
    time: c.time,
    value: {
      supertrend: i < UNDIRECTED ? null : c.close - 5,
      direction: i < UNDIRECTED ? 0 : 1,
      upperBand: c.close + 5,
      lowerBand: c.close - 5,
    },
  }));
  const s: InternalSeries = {
    id: "st",
    paneId: "main",
    scaleId: "right",
    type: "line",
    config: { channelColors: { upperBand: "down", lowerBand: "up" } },
    data,
    visible: true,
    _rule: defaultRegistry.detect(data),
  };
  return { s, candles };
}

describe("supertrend rendering with no direction", () => {
  it("draws only the directed bars, in the bullish colour", () => {
    const { s, candles } = series();
    expect(s._rule?.name).toBe("supertrend");
    const ctx = mockCtx();
    const styles: string[] = [];
    const traced = new Proxy(ctx, {
      set(target, prop, value) {
        if (prop === "fillStyle" || prop === "strokeStyle") styles.push(value);
        return Reflect.set(target, prop, value);
      },
    });
    const dataLayer = { candles } as unknown as Parameters<typeof dispatchSeries>[4];
    dispatchSeries(
      traced,
      s,
      makeTimeScale(N, 600),
      makePriceScale(400, 90, 140),
      dataLayer,
      600,
      DARK_THEME,
    );
    // Previously the undirected bars filled and stroked the upper band in
    // the bearish colour, then switched to bullish at the first break.
    expect(styles.some((c) => c.startsWith("down"))).toBe(false);
    expect(styles).toContain("up");
  });
});
