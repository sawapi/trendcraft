import { describe, expect, it } from "vitest";
import { PriceScale, TimeScale } from "../core/scale";

describe("TimeScale", () => {
  it("converts index to x and back", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    const x = ts.indexToX(10);
    expect(x).toBeGreaterThan(0);

    const idx = ts.xToIndex(x);
    expect(idx).toBe(10);
  });

  it("scrollToEnd positions last candles in view", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.scrollToEnd();

    expect(ts.endIndex).toBe(500);
    expect(ts.startIndex).toBeGreaterThan(0);
  });

  it("fitContent shows all candles", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(50);
    ts.fitContent();

    expect(ts.startIndex).toBe(0);
    // Should see all candles (or close to it)
    expect(ts.endIndex).toBeGreaterThanOrEqual(50);
  });

  it("zoom changes visible count", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(200);

    const beforeCount = ts.visibleCount;
    ts.zoom(0.5); // Zoom in
    expect(ts.visibleCount).not.toBe(beforeCount);
  });

  it("scrollBy moves the visible range", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(200);

    const before = ts.startIndex;
    ts.scrollBy(10);
    expect(ts.startIndex).toBe(before + 10);
  });

  it("clamps startIndex to valid range", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    ts.scrollBy(-1000); // Scroll way left
    expect(ts.startIndex).toBe(0);
  });

  it("candleWidth is proportional to barSpacing", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    expect(ts.candleWidth).toBeGreaterThan(0);
    expect(ts.candleWidth).toBeLessThanOrEqual(ts.barSpacing);
  });
});

describe("PriceScale", () => {
  it("maps price to y pixel (higher price = lower y)", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(100, 200);

    const yHigh = ps.priceToY(200);
    const yLow = ps.priceToY(100);

    expect(yHigh).toBeLessThan(yLow);
  });

  it("round-trips price through priceToY/yToPrice", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(50, 150);

    const testPrice = 100;
    const y = ps.priceToY(testPrice);
    const recovered = ps.yToPrice(y);

    expect(recovered).toBeCloseTo(testPrice, 5);
  });

  it("respects fixed range", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setFixedRange([0, 100]);
    ps.setDataRange(20, 80); // Should be ignored

    expect(ps.min).toBe(0);
    expect(ps.max).toBe(100);
  });

  it("generates nice tick values", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(0, 100);

    const ticks = ps.getTicks();
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(8);

    // Ticks should be within range
    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(ps.min);
      expect(tick).toBeLessThanOrEqual(ps.max);
    }
  });

  it("log mode maps correctly", () => {
    const ps = new PriceScale();
    ps.setMode("log");
    ps.setHeight(400);
    ps.setDataRange(10, 1000);

    const y10 = ps.priceToY(10);
    const y100 = ps.priceToY(100);
    const y1000 = ps.priceToY(1000);

    // In log scale, equal ratios should have more equal spacing
    expect(y10).toBeGreaterThan(y100);
    expect(y100).toBeGreaterThan(y1000);
  });
});
