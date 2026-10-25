/** hmmRegimes() output matched no rule and drew nothing (ops #32). */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { defaultRegistry } from "../core/series-registry";
import type { DataPoint } from "../core/types";
import { introspect } from "../integration/series-introspector";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

describe("hmmRegime (ops #32)", () => {
  // The shape of trendcraft's HmmRegimeValue.
  const data: DataPoint<unknown>[] = Array.from({ length: 20 }, (_, i) => ({
    time: i * 60_000,
    value: {
      regime: i % 3,
      label: `s${i % 3}`,
      probabilities: [0.2, 0.3, 0.5],
      logLikelihood: -10,
    },
  }));

  it("detects hmmRegimes() output", () => {
    expect(defaultRegistry.detect(data)?.name).toBe("hmmRegime");
  });

  it("no longer captures volatilityRegime-shaped values", () => {
    const vr = [{ time: 0, value: { regime: "low", confidence: 0.8, atrPercentile: 10 } }];
    expect(defaultRegistry.detect(vr)?.name).not.toBe("hmmRegime");
  });

  it("draws the regime index with finite coordinates", () => {
    const { config } = introspect(data, {});
    const s = { id: "r", data, config, visible: true } as unknown as InternalSeries;
    const ctx = mockCtx();
    dispatchSeries(ctx, s, makeTimeScale(20, 800), makePriceScale(200, 0, 2));
    const ys = (ctx.lineTo as unknown as { mock: { calls: number[][] } }).mock.calls.map(
      (c) => c[1],
    );
    expect(ys.length).toBeGreaterThan(0);
    expect(ys.every(Number.isFinite)).toBe(true);
  });
});
