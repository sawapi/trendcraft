import { expect, test } from "@playwright/test";
import {
  chartBox,
  frames,
  isFlinging,
  isMoving,
  logicalRange,
  openChart,
  wheelFlick,
} from "./helpers";

test.describe("pan and zoom", () => {
  test("wheel up zooms in: fewer bars are visible", async ({ page }) => {
    await openChart(page);
    const before = await logicalRange(page);
    const box = await chartBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.wheel(0, -400);
    await expect
      .poll(async () => {
        const r = await logicalRange(page);
        return r.to - r.from;
      })
      .toBeLessThan(before.to - before.from);
  });

  test("dragging right pans back in time", async ({ page }) => {
    await openChart(page);
    const before = await logicalRange(page);
    const box = await chartBox(page);
    const y = box.y + box.height / 3;
    await page.mouse.move(box.x + 300, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await logicalRange(page)).from).toBeLessThan(before.from);
  });

  test("moving the pointer emits crosshairMove with the bar under it", async ({ page }) => {
    await openChart(page);
    const box = await chartBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__tc.events.filter(
              (e) =>
                e.type === "crosshairMove" && (e.data as { index: number | null }).index !== null,
            ).length,
        ),
      )
      .toBeGreaterThan(0);
  });

  test("a horizontal wheel flick starts a fling", async ({ page }) => {
    await openChart(page);
    await wheelFlick(page);
    const afterEvents = await logicalRange(page);
    // Poll at a fixed short interval: the fling decays in under a second, and
    // expect.poll's default back-off (100, 250, 500, 1000 ms) can step over it.
    await expect.poll(() => isFlinging(page), { intervals: [50], timeout: 3_000 }).toBe(true);
    await expect.poll(() => isMoving(page), { intervals: [50], timeout: 5_000 }).toBe(false);
    // The fling carried the view well past where the events left it.
    const travel = afterEvents.from - (await logicalRange(page)).from;
    expect(travel).toBeGreaterThan(5);
  });

  // ops #36: a press used to leave the fling running. The test above guards
  // the setup, and the skip keeps a fling that never started from passing
  // vacuously.
  test("pressing the mouse stops a wheel fling (ops #36)", async ({ page }) => {
    await openChart(page);
    const box = await chartBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await wheelFlick(page);
    let moving = false;
    for (let i = 0; i < 30 && !moving; i++) moving = await isFlinging(page);
    test.skip(!moving, "the fling did not start, so the press cannot be observed");

    // Grab the chart while it is still moving.
    await page.mouse.down();
    const held = await logicalRange(page);
    await frames(page, 10);
    const later = await logicalRange(page);
    await page.mouse.up();
    expect(Math.abs(later.from - held.from)).toBeLessThan(0.01);
  });
});
