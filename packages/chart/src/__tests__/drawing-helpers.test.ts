import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartInstance, Drawing } from "../core/types";
import {
  DEFAULT_FIB_EXTENSION_LEVELS,
  DEFAULT_FIB_RETRACEMENT_LEVELS,
  type SwingAnchor,
  addAutoChannelLine,
  addAutoFibExtension,
  addAutoFibRetracement,
  addAutoTrendLine,
} from "../integration/drawing-helpers";

function mockChart() {
  const drawings: Drawing[] = [];
  const addDrawing = vi.fn((d: Drawing) => {
    drawings.push(d);
  });
  // Minimal ChartInstance shape — only addDrawing is exercised.
  return { chart: { addDrawing } as unknown as ChartInstance, drawings, addDrawing };
}

const anchors: SwingAnchor[] = [
  { time: 1_000, price: 100, type: "low" },
  { time: 2_000, price: 120, type: "high" },
  { time: 3_000, price: 105, type: "low" },
  { time: 4_000, price: 130, type: "high" },
  { time: 5_000, price: 115, type: "low" },
];

describe("drawing-helpers", () => {
  let env: ReturnType<typeof mockChart>;

  beforeEach(() => {
    env = mockChart();
  });

  describe("addAutoFibRetracement", () => {
    it("creates a fibRetracement drawing from the latest high+low swings", () => {
      const id = addAutoFibRetracement(env.chart, anchors);
      expect(id).not.toBeNull();
      expect(env.drawings).toHaveLength(1);
      const d = env.drawings[0];
      expect(d.type).toBe("fibRetracement");
      if (d.type !== "fibRetracement") throw new Error();
      // Latest high (4000/130) is older than latest low (5000/115) → start=high, end=low.
      expect(d.startTime).toBe(4_000);
      expect(d.startPrice).toBe(130);
      expect(d.endTime).toBe(5_000);
      expect(d.endPrice).toBe(115);
      expect(d.levels).toEqual(DEFAULT_FIB_RETRACEMENT_LEVELS);
    });

    it("honors custom levels + id override", () => {
      addAutoFibRetracement(env.chart, anchors, {
        id: "custom-fib",
        levels: [0, 0.5, 1],
      });
      expect(env.drawings[0].id).toBe("custom-fib");
      if (env.drawings[0].type !== "fibRetracement") throw new Error();
      expect(env.drawings[0].levels).toEqual([0, 0.5, 1]);
    });

    it("returns null when fewer than two swings provided", () => {
      expect(addAutoFibRetracement(env.chart, [])).toBeNull();
      expect(addAutoFibRetracement(env.chart, [anchors[0]])).toBeNull();
      expect(env.drawings).toHaveLength(0);
    });

    it("returns null when only one side (all highs) is available", () => {
      const highsOnly: SwingAnchor[] = [
        { time: 1, price: 100, type: "high" },
        { time: 2, price: 110, type: "high" },
      ];
      expect(addAutoFibRetracement(env.chart, highsOnly)).toBeNull();
    });
  });

  describe("addAutoFibExtension", () => {
    it("creates a fibExtension drawing from A→B of the last three alternating anchors", () => {
      const id = addAutoFibExtension(env.chart, anchors);
      expect(id).not.toBeNull();
      expect(env.drawings).toHaveLength(1);
      const d = env.drawings[0];
      if (d.type !== "fibExtension") throw new Error();
      // Last three = [3000/low/105, 4000/high/130, 5000/low/115] → A=3000, B=4000.
      expect(d.startTime).toBe(3_000);
      expect(d.startPrice).toBe(105);
      expect(d.endTime).toBe(4_000);
      expect(d.endPrice).toBe(130);
      expect(d.levels).toEqual(DEFAULT_FIB_EXTENSION_LEVELS);
    });

    it("returns null when fewer than three anchors provided", () => {
      expect(addAutoFibExtension(env.chart, anchors.slice(0, 2))).toBeNull();
    });
  });

  describe("addAutoTrendLine", () => {
    it("draws resistance through the last two highs", () => {
      addAutoTrendLine(env.chart, anchors, { line: "resistance" });
      const d = env.drawings[0];
      if (d.type !== "trendline") throw new Error();
      expect(d.startTime).toBe(2_000);
      expect(d.startPrice).toBe(120);
      expect(d.endTime).toBe(4_000);
      expect(d.endPrice).toBe(130);
    });

    it("defaults to resistance when line option is omitted", () => {
      addAutoTrendLine(env.chart, anchors);
      const d = env.drawings[0];
      if (d.type !== "trendline") throw new Error();
      expect(d.startTime).toBe(2_000);
      expect(d.endTime).toBe(4_000);
    });

    it("draws support through the last two lows", () => {
      addAutoTrendLine(env.chart, anchors, { line: "support" });
      const d = env.drawings[0];
      if (d.type !== "trendline") throw new Error();
      // Last two lows: 3000/105 → 5000/115.
      expect(d.startTime).toBe(3_000);
      expect(d.startPrice).toBe(105);
      expect(d.endTime).toBe(5_000);
      expect(d.endPrice).toBe(115);
    });

    it("projects the endpoint using the slope when extendToTime is given", () => {
      addAutoTrendLine(env.chart, anchors, { line: "support", extendToTime: 7_000 });
      const d = env.drawings[0];
      if (d.type !== "trendline") throw new Error();
      // slope = (115-105)/(5000-3000) = 0.005 per unit time.
      // at t=7000 → 115 + 0.005 * (7000-5000) = 125.
      expect(d.endTime).toBe(7_000);
      expect(d.endPrice).toBeCloseTo(125, 5);
    });

    it("returns null when fewer than two same-type swings exist", () => {
      const onlyOneHigh: SwingAnchor[] = [
        { time: 1, price: 100, type: "high" },
        { time: 2, price: 95, type: "low" },
      ];
      expect(addAutoTrendLine(env.chart, onlyOneHigh, { line: "resistance" })).toBeNull();
    });
  });

  describe("addAutoChannelLine", () => {
    it("draws a channel using two lows as the base and the intervening high for width", () => {
      addAutoChannelLine(env.chart, anchors);
      const d = env.drawings[0];
      if (d.type !== "channel") throw new Error();
      // trio = [3000/low/105, 4000/high/130, 5000/low/115]
      // base = two lows: 3000/105 → 5000/115, slope = 0.005/unit
      // opposite high @4000: line-at-4000 = 105 + 0.005*(4000-3000) = 110 → width = 130 - 110 = 20
      expect(d.startTime).toBe(3_000);
      expect(d.endTime).toBe(5_000);
      expect(d.channelWidth).toBeCloseTo(20, 5);
    });

    it("extends the base line to extendToTime", () => {
      addAutoChannelLine(env.chart, anchors, { extendToTime: 7_000 });
      const d = env.drawings[0];
      if (d.type !== "channel") throw new Error();
      expect(d.endTime).toBe(7_000);
      expect(d.endPrice).toBeCloseTo(125, 5);
    });

    it("returns null for insufficient anchors", () => {
      expect(addAutoChannelLine(env.chart, anchors.slice(0, 2))).toBeNull();
    });
  });

  describe("id generation", () => {
    it("uses idPrefix to namespace auto-generated ids", () => {
      addAutoFibRetracement(env.chart, anchors, { idPrefix: "my-fib" });
      expect(env.drawings[0].id.startsWith("my-fib-")).toBe(true);
    });

    it("accepts an explicit id override", () => {
      addAutoFibRetracement(env.chart, anchors, { id: "pinned" });
      expect(env.drawings[0].id).toBe("pinned");
    });
  });
});
