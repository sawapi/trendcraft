import { expect, test } from "@playwright/test";
import { logicalRange, openChart, touchDriver } from "./helpers";

const width = (r: { from: number; to: number }) => r.to - r.from;

test.describe("touch", () => {
  test("lifting one finger after a pinch lets the other pan (ops #35)", async ({ page }) => {
    await openChart(page);
    const touch = await touchDriver(page);
    const y = 200;
    await touch("touchStart", [
      { id: 1, x: 300, y },
      { id: 2, x: 500, y },
    ]);
    await touch("touchMove", [
      { id: 1, x: 280, y },
      { id: 2, x: 520, y },
    ]);
    const pinched = await logicalRange(page);
    expect(width(pinched)).toBeLessThan(90); // the pinch zoomed in

    await touch("touchEnd", [{ id: 2, x: 520, y }]);
    for (const x of [300, 320, 340, 360]) await touch("touchMove", [{ id: 1, x, y }]);
    const panned = await logicalRange(page);
    await touch("touchEnd", [{ id: 1, x: 360, y }]);

    // Dragging right reveals the past; the zoom is unchanged.
    expect(panned.from).toBeLessThan(pinched.from - 3);
    expect(width(panned)).toBeCloseTo(width(pinched), 6);
  });
});
