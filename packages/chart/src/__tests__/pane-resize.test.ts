import { describe, expect, it } from "vitest";
import { LayoutEngine } from "../core/layout";

describe("Pane Resize", () => {
  it("gapAtY detects gap between panes", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    const mainPane = le.paneRects[0];
    const gapY = mainPane.y + mainPane.height + 1;

    expect(le.gapAtY(gapY)).toBe(0);
  });

  it("gapAtY returns null when not on gap", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    expect(le.gapAtY(100)).toBeNull(); // Inside main pane
  });

  it("resizePanes adjusts flex values", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    const mainFlexBefore = le.config.panes[0].flex;
    const volumeFlexBefore = le.config.panes[1].flex;

    le.resizePanes(0, 50); // Move divider down 50px

    expect(le.config.panes[0].flex).toBeGreaterThan(mainFlexBefore);
    expect(le.config.panes[1].flex).toBeLessThan(volumeFlexBefore);
  });

  it("resizePanes enforces minimum pane height", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    // Try to resize volume pane to near-zero
    le.resizePanes(0, 9999);

    // Both panes should still have positive height
    for (const rect of le.paneRects) {
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  it("resizePanes ignores invalid gap index", () => {
    const le = new LayoutEngine();
    le.setDimensions(800, 600, 60, 24);

    const flexBefore = le.config.panes[0].flex;
    le.resizePanes(99, 50);

    expect(le.config.panes[0].flex).toBe(flexBefore);
  });
});
