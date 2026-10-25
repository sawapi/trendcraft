import { expect, test } from "@playwright/test";
import { isMoving, logicalRange, openChart, scrollbarThumb } from "./helpers";

const width = (r: { from: number; to: number }) => r.to - r.from;

test.describe("navigation keeps the zoom", () => {
  // 20,000 bars fitted to the view is ~0.35 px per bar, below the 2 px floor
  // that setVisibleRange clamps to. A pan must not snap it back (ops #28).
  test.beforeEach(async ({ page }) => {
    await openChart(page, "?bars=20000&volume=0");
    await page.evaluate(() => window.__tc.chart.fitContent());
    // fitContent animates: wait until the fitted range has settled, or the
    // test would measure a mid-animation width and prove nothing.
    await expect.poll(async () => width(await logicalRange(page))).toBeGreaterThan(1000);
    await expect.poll(() => isMoving(page), { intervals: [50] }).toBe(false);
  });

  test("End then Home move to each end without zooming in (ops #28)", async ({ page }) => {
    const fitted = await logicalRange(page);
    await page.evaluate(() => (document.querySelector("#chart canvas") as HTMLElement).focus());
    // The fitted view starts at bar 0; go to the end first so Home has to move.
    await page.keyboard.press("End");
    await expect.poll(async () => (await logicalRange(page)).from).toBeGreaterThan(1000);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await logicalRange(page)).from).toBeLessThan(1);
    expect(width(await logicalRange(page))).toBeCloseTo(width(fitted), 0);
  });

  test("dragging the scrollbar thumb pans without zooming in (ops #28)", async ({ page }) => {
    const fitted = await logicalRange(page);
    const thumb = await scrollbarThumb(page);
    await page.mouse.move(thumb.x, thumb.y);
    await page.mouse.down();
    // The fitted view starts at bar 0, so drag toward the end.
    await page.mouse.move(thumb.x + 100, thumb.y, { steps: 5 });
    await page.mouse.up();
    const after = await logicalRange(page);
    expect(after.from).toBeGreaterThan(fitted.from + 100);
    expect(width(after)).toBeCloseTo(width(fitted), 0);
  });
});
