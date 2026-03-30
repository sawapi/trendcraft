import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type {
  ArrowDrawing,
  ChannelDrawing,
  Drawing,
  FibExtensionDrawing,
  FibRetracementDrawing,
  HLineDrawing,
  HRayDrawing,
  RayDrawing,
  RectangleDrawing,
  TextLabelDrawing,
  TrendLineDrawing,
  VLineDrawing,
} from "../core/types";

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

  it("adds a ray drawing", () => {
    const dl = new DataLayer();
    const ray: RayDrawing = {
      id: "ray1",
      type: "ray",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 110,
    };
    dl.addDrawing(ray);
    expect(dl.getDrawings()[0].type).toBe("ray");
  });

  it("adds an hray drawing", () => {
    const dl = new DataLayer();
    const hray: HRayDrawing = { id: "hray1", type: "hray", time: 1000, price: 100 };
    dl.addDrawing(hray);
    expect(dl.getDrawings()[0].type).toBe("hray");
    expect((dl.getDrawings()[0] as HRayDrawing).price).toBe(100);
  });

  it("adds a vline drawing", () => {
    const dl = new DataLayer();
    const vline: VLineDrawing = { id: "vl1", type: "vline", time: 1500 };
    dl.addDrawing(vline);
    expect(dl.getDrawings()[0].type).toBe("vline");
  });

  it("adds a rectangle drawing", () => {
    const dl = new DataLayer();
    const rect: RectangleDrawing = {
      id: "rect1",
      type: "rectangle",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 120,
      fillColor: "rgba(255,0,0,0.2)",
    };
    dl.addDrawing(rect);
    expect(dl.getDrawings()[0].type).toBe("rectangle");
    expect((dl.getDrawings()[0] as RectangleDrawing).fillColor).toBe("rgba(255,0,0,0.2)");
  });

  it("adds a channel drawing", () => {
    const dl = new DataLayer();
    const ch: ChannelDrawing = {
      id: "ch1",
      type: "channel",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 120,
      channelWidth: 10,
    };
    dl.addDrawing(ch);
    expect(dl.getDrawings()[0].type).toBe("channel");
    expect((dl.getDrawings()[0] as ChannelDrawing).channelWidth).toBe(10);
  });

  it("adds a fibExtension drawing", () => {
    const dl = new DataLayer();
    const ext: FibExtensionDrawing = {
      id: "fe1",
      type: "fibExtension",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 120,
      levels: [0, 1, 1.618, 2.618],
    };
    dl.addDrawing(ext);
    expect(dl.getDrawings()[0].type).toBe("fibExtension");
    expect((dl.getDrawings()[0] as FibExtensionDrawing).levels).toEqual([0, 1, 1.618, 2.618]);
  });

  it("adds a textLabel drawing", () => {
    const dl = new DataLayer();
    const label: TextLabelDrawing = {
      id: "txt1",
      type: "textLabel",
      time: 1500,
      price: 110,
      text: "Support",
    };
    dl.addDrawing(label);
    expect(dl.getDrawings()[0].type).toBe("textLabel");
    expect((dl.getDrawings()[0] as TextLabelDrawing).text).toBe("Support");
  });

  it("adds an arrow drawing", () => {
    const dl = new DataLayer();
    const arrow: ArrowDrawing = {
      id: "arr1",
      type: "arrow",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 110,
    };
    dl.addDrawing(arrow);
    expect(dl.getDrawings()[0].type).toBe("arrow");
  });

  it("supports all 11 drawing types simultaneously", () => {
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
    dl.addDrawing({
      id: "ray1",
      type: "ray",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 110,
    });
    dl.addDrawing({ id: "hray1", type: "hray", time: 1000, price: 100 });
    dl.addDrawing({ id: "vl1", type: "vline", time: 1500 });
    dl.addDrawing({
      id: "rect1",
      type: "rectangle",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 120,
    });
    dl.addDrawing({
      id: "ch1",
      type: "channel",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 120,
      channelWidth: 10,
    });
    dl.addDrawing({
      id: "fe1",
      type: "fibExtension",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 120,
    });
    dl.addDrawing({ id: "txt1", type: "textLabel", time: 1500, price: 110, text: "Note" });
    dl.addDrawing({
      id: "arr1",
      type: "arrow",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 110,
    });

    const drawings = dl.getDrawings();
    expect(drawings.length).toBe(11);
    expect(drawings.map((d) => d.type).sort()).toEqual([
      "arrow",
      "channel",
      "fibExtension",
      "fibRetracement",
      "hline",
      "hray",
      "ray",
      "rectangle",
      "textLabel",
      "trendline",
      "vline",
    ]);
  });

  it("overwrites drawing with same id", () => {
    const dl = new DataLayer();
    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    dl.addDrawing({ id: "h1", type: "hline", price: 200 });

    const drawings = dl.getDrawings();
    expect(drawings.length).toBe(1);
    expect((drawings[0] as HLineDrawing).price).toBe(200);
  });

  it("returns empty array when no drawings", () => {
    const dl = new DataLayer();
    expect(dl.getDrawings()).toEqual([]);
    expect(dl.drawings.length).toBe(0);
  });

  it("fib retracement supports custom levels", () => {
    const dl = new DataLayer();
    const fib: FibRetracementDrawing = {
      id: "fib1",
      type: "fibRetracement",
      startTime: 1000,
      startPrice: 100,
      endTime: 2000,
      endPrice: 200,
      levels: [0, 0.5, 1],
    };
    dl.addDrawing(fib);
    const drawing = dl.getDrawings()[0] as FibRetracementDrawing;
    expect(drawing.levels).toEqual([0, 0.5, 1]);
  });
});
