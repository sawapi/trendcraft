import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { LayoutEngine } from "../core/layout";
import type { DataPoint } from "../core/types";

describe("Pane Lifecycle", () => {
  it("removePane removes a subchart pane", () => {
    const layout = new LayoutEngine();
    layout.setDimensions(800, 600, 60, 24);
    layout.addPane({ id: "rsi", flex: 1 });

    expect(layout.hasPane("rsi")).toBe(true);
    expect(layout.removePane("rsi")).toBe(true);
    expect(layout.hasPane("rsi")).toBe(false);
  });

  it("removePane refuses to remove main pane", () => {
    const layout = new LayoutEngine();
    layout.setDimensions(800, 600, 60, 24);

    expect(layout.removePane("main")).toBe(false);
    expect(layout.hasPane("main")).toBe(true);
  });

  it("removePane refuses to remove volume pane", () => {
    const layout = new LayoutEngine();
    layout.setDimensions(800, 600, 60, 24);

    expect(layout.removePane("volume")).toBe(false);
    expect(layout.hasPane("volume")).toBe(true);
  });

  it("fires onPaneEmpty when last series is removed", () => {
    const dl = new DataLayer();
    const emptiedPanes: string[] = [];
    dl.setOnPaneEmpty((id) => emptiedPanes.push(id));

    const data: DataPoint<number>[] = [{ time: 1, value: 42 }];
    const handle = dl.addSeries(data, { pane: "rsi" }, "line");

    expect(emptiedPanes.length).toBe(0);
    handle.remove();
    expect(emptiedPanes).toEqual(["rsi"]);
  });

  it("does not fire onPaneEmpty when other series remain", () => {
    const dl = new DataLayer();
    const emptiedPanes: string[] = [];
    dl.setOnPaneEmpty((id) => emptiedPanes.push(id));

    const data: DataPoint<number>[] = [{ time: 1, value: 42 }];
    const h1 = dl.addSeries(data, { pane: "rsi" }, "line");
    dl.addSeries(data, { pane: "rsi" }, "line");

    h1.remove();
    expect(emptiedPanes.length).toBe(0);
  });

  it("layout recomputes after pane removal", () => {
    const layout = new LayoutEngine();
    layout.setDimensions(800, 600, 60, 24);

    layout.addPane({ id: "rsi", flex: 1 });
    const rectsBefore = layout.paneRects.length;

    layout.removePane("rsi");
    expect(layout.paneRects.length).toBe(rectsBefore - 1);

    // Remaining panes should fill full height
    const totalHeight = layout.paneRects.reduce((s, r) => s + r.height, 0);
    expect(totalHeight).toBeGreaterThan(0);
  });
});
