/**
 * A batch indicator and its live preset describe the same series, so they
 * must carry the same metadata. The chart places a series by `__meta.overlay`
 * ahead of its own rules, so when the batch function hand-wrote a tag that
 * disagreed with the exported `*_META` constant, `chart.addIndicator(x(candles))`
 * and `connectIndicators(...).add("x")` put the same indicator on different
 * panes (gapAnalysis drew percentages on the price pane).
 */

import { describe, expect, it } from "vitest";
import * as trendcraft from "../../index";
import type { NormalizedCandle } from "../../types";
import type { SeriesMeta } from "../../types/candle";
import { livePresets } from "../live-presets";

/** Preset ids whose batch function has a different export name. */
const BATCH_NAME: Record<string, string> = {
  mcginley: "mcginleyDynamic",
  ao: "awesomeOscillator",
  bop: "balanceOfPower",
  coppock: "coppockCurve",
  stc: "schaffTrendCycle",
  bb: "bollingerBands",
  donchian: "donchianChannel",
  keltner: "keltnerChannel",
  choppiness: "choppinessIndex",
  hv: "historicalVolatility",
  ulcer: "ulcerIndex",
  emv: "easeOfMovement",
  orb: "openingRange",
  fvg: "fairValueGap",
};

/** Presets with no candle-input batch counterpart. */
const NO_BATCH = new Set([
  // ewmaVolatility takes a returns array, not candles.
  "ewmaVol",
]);

const DAY = 86_400_000;
const candles: NormalizedCandle[] = Array.from({ length: 400 }, (_, i) => {
  const close = 100 + 10 * Math.sin(i / 7) + i * 0.05 + (i % 5 === 0 ? 3 : 0);
  return {
    time: Date.UTC(2024, 0, 1) + i * DAY,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i,
  };
});

// The label carries the parameters ("SMA(20)"), so it legitimately differs.
const withoutLabel = ({ label: _label, ...rest }: SeriesMeta) => rest;

describe("batch indicator metadata matches its live preset", () => {
  const cases = Object.entries(livePresets).filter(([id]) => !NO_BATCH.has(id));

  it.each(cases)("%s", (id, preset) => {
    const batch = (trendcraft as unknown as Record<string, unknown>)[BATCH_NAME[id] ?? id];
    expect(typeof batch, `no batch export for preset "${id}"`).toBe("function");

    const params = { ...preset.defaultParams, anchorTime: candles[10].time };
    const series = (batch as (c: NormalizedCandle[], o: unknown) => { __meta?: SeriesMeta })(
      candles,
      params,
    );

    expect(series.__meta, `${id} returns an untagged series`).toBeDefined();
    expect(withoutLabel(series.__meta as SeriesMeta)).toEqual(withoutLabel(preset.meta));
  });
});
