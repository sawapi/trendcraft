import { describe, expect, it } from "vitest";
import { LayoutEngine } from "../core/layout";

describe("LayoutEngine", () => {
  it("computes pane rects from flex proportions", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    const rects = le.paneRects;
    expect(rects.length).toBe(2); // default: main + volume

    // Main should be larger than volume (flex 3 vs 0.7)
    const main = rects.find((r) => r.id === "main")!;
    const vol = rects.find((r) => r.id === "volume")!;
    expect(main.height).toBeGreaterThan(vol.height);

    // Widths should match data area
    expect(main.width).toBe(le.dataAreaWidth);
    expect(vol.width).toBe(le.dataAreaWidth);
  });

  it("dataAreaWidth excludes price axis", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    expect(le.dataAreaWidth).toBe(740);
  });

  it("adds pane dynamically", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    expect(le.paneRects.length).toBe(2);
    le.addPane({ id: "rsi", flex: 1 });
    expect(le.paneRects.length).toBe(3);
    expect(le.hasPane("rsi")).toBe(true);
  });

  it("panes fill available height (minus gaps)", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    le.setLayout({
      panes: [
        { id: "main", flex: 3 },
        { id: "volume", flex: 1 },
        { id: "rsi", flex: 1 },
      ],
      gap: 4,
    });

    const rects = le.paneRects;
    const totalPaneHeight = rects.reduce((sum, r) => sum + r.height, 0);
    const totalGaps = (rects.length - 1) * 4;

    // Total should be close to available height
    expect(totalPaneHeight + totalGaps).toBeCloseTo(le.dataAreaHeight, -1);
  });

  it("paneAtY returns correct pane", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    const main = le.paneRects.find((r) => r.id === "main")!;
    const result = le.paneAtY(main.y + 10);
    expect(result?.id).toBe("main");
  });

  it("handles custom layout with fixed range pane", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    le.setLayout({
      panes: [
        { id: "main", flex: 3 },
        { id: "rsi", flex: 1, yRange: [0, 100], referenceLines: [30, 70] },
      ],
      gap: 4,
    });

    const rsiPane = le.getPane("rsi");
    expect(rsiPane?.yRange).toEqual([0, 100]);
    expect(rsiPane?.referenceLines).toEqual([30, 70]);
  });

  it("gapAtY with 3 panes", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);
    le.addPane({ id: "rsi", flex: 1 });

    // Should have 2 gaps (main-volume, volume-rsi)
    const mainBottom = le.paneRects[0].y + le.paneRects[0].height;
    const volBottom = le.paneRects[1].y + le.paneRects[1].height;

    expect(le.gapAtY(mainBottom + 1)).toBe(0);
    expect(le.gapAtY(volBottom + 1)).toBe(1);
  });

  it("resizePanes with 3 panes resizes correct pair", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);
    le.addPane({ id: "rsi", flex: 1 });

    const rsiFlex = le.config.panes[2].flex;
    le.resizePanes(1, -20); // Shrink volume, expand rsi

    expect(le.config.panes[2].flex).toBeGreaterThan(rsiFlex);
  });
});
