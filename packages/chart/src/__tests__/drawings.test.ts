import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { Drawing, FibRetracementDrawing, HLineDrawing, TrendLineDrawing } from "../core/types";

describe("Drawings", () => {
  it("adds and retrieves an hline drawing", () => {
    const dl = new DataLayer();
    const hline: HLineDrawing = { id: "h1", type: "hline", price: 100, color: "#FF0000" };
    dl.addDrawing(hline);

    const drawings = dl.getDrawings();
    expect(drawings.length).toBe(1);
    expect(drawings[0].type).toBe("hline");
    expect((drawings[0] as HLineDrawing).price).toBe(100);
  });

  it("adds a trendline drawing", () => {
    const dl = new DataLayer();
    const tl: TrendLineDrawing = {
      id: "tl1",
      type: "trendline",
      startTime: 1000,
      startPrice: 90,
      endTime: 2000,
      endPrice: 110,
    };
    dl.addDrawing(tl);
    expect(dl.getDrawings().length).toBe(1);
  });

  it("adds a fibonacci retracement drawing", () => {
    const dl = new DataLayer();
    const fib: FibRetracementDrawing = {
      id: "fib1",
      type: "fibRetracement",
      startTime: 1000,
      startPrice: 80,
      endTime: 3000,
      endPrice: 120,
    };
    dl.addDrawing(fib);
    expect(dl.getDrawings().length).toBe(1);
  });

  it("removes a drawing by id", () => {
    const dl = new DataLayer();
    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    dl.addDrawing({ id: "h2", type: "hline", price: 200 });

    expect(dl.getDrawings().length).toBe(2);
    dl.removeDrawing("h1");
    expect(dl.getDrawings().length).toBe(1);
    expect(dl.getDrawings()[0].id).toBe("h2");
  });

  it("marks dirty on add/remove", () => {
    const dl = new DataLayer();
    dl.clearDirty();

    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    expect(dl.dirty).toBe(true);

    dl.clearDirty();
    dl.removeDrawing("h1");
    expect(dl.dirty).toBe(true);
  });

  it("handles removing non-existent drawing", () => {
    const dl = new DataLayer();
    dl.removeDrawing("nonexistent");
    expect(dl.getDrawings().length).toBe(0);
  });

  it("supports multiple drawing types simultaneously", () => {
    const dl = new DataLayer();
    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    dl.addDrawing({
      id: "tl1",
      type: "trendline",
      startTime: 1000,
      startPrice: 90,
      endTime: 2000,
      endPrice: 110,
    });
    dl.addDrawing({
      id: "fib1",
      type: "fibRetracement",
      startTime: 1000,
      startPrice: 80,
      endTime: 3000,
      endPrice: 120,
    });

    const drawings = dl.getDrawings();
    expect(drawings.length).toBe(3);
    expect(drawings.map((d) => d.type).sort()).toEqual(["fibRetracement", "hline", "trendline"]);
  });
});
