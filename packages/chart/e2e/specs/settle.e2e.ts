import { expect, type Page, test } from "@playwright/test";
import { chartBox, isMoving, logicalRange, openChart, touchDriver, wheelFlick } from "./helpers";

/**
 * A press that stops a running fling or bounce owes the settling that loop
 * would have done. Stopping a bounce and then doing nothing left the chart
 * stuck past the data edge.
 */

/** Flick toward the future from the right-end fixture: the view overscrolls and bounces back. */
async function flickIntoTheEdge(page: Page): Promise<void> {
  await wheelFlick(page, 120);
}

async function settledFrom(page: Page): Promise<number> {
  await expect.poll(() => isMoving(page), { intervals: [50], timeout: 5_000 }).toBe(false);
  return (await logicalRange(page)).from;
}

/** Where the same flick comes to rest when nothing interrupts it. */
async function referenceRest(page: Page): Promise<number> {
  await openChart(page);
  await flickIntoTheEdge(page);
  // The bounce starts only when the wheel session ends (150 ms after the last
  // event): wait for it to start before waiting for it to stop, or this reads
  // the overscrolled position before anything has moved.
  expect(await waitForBounce(page), "the reference bounce did not start").toBe(true);
  return settledFrom(page);
}

async function waitForBounce(page: Page): Promise<boolean> {
  for (let i = 0; i < 30; i++) if (await isMoving(page)) return true;
  return false;
}

test.describe("a press during a bounce still settles", () => {
  test("a click mid-bounce still comes to rest at the edge", async ({ page }) => {
    const reference = await referenceRest(page);

    await openChart(page);
    const box = await chartBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await flickIntoTheEdge(page);
    test.skip(!(await waitForBounce(page)), "the bounce did not start");
    await page.mouse.down();
    await page.mouse.up();
    expect(await settledFrom(page)).toBeCloseTo(reference, 1);
  });

  test("a tap mid-bounce still comes to rest at the edge", async ({ page }) => {
    const reference = await referenceRest(page);

    await openChart(page);
    const touch = await touchDriver(page);
    await flickIntoTheEdge(page);
    test.skip(!(await waitForBounce(page)), "the bounce did not start");
    await touch("touchStart", [{ id: 1, x: 400, y: 150 }]);
    await touch("touchEnd", [{ id: 1, x: 400, y: 150 }]);
    expect(await settledFrom(page)).toBeCloseTo(reference, 1);
  });

  test("a long-press mid-bounce still comes to rest at the edge", async ({ page }) => {
    const reference = await referenceRest(page);

    await openChart(page);
    const touch = await touchDriver(page);
    await flickIntoTheEdge(page);
    test.skip(!(await waitForBounce(page)), "the bounce did not start");
    await touch("touchStart", [{ id: 1, x: 400, y: 150 }]);
    // Hold past the 500 ms long-press threshold so the touch locks the
    // crosshair. The threshold is wall-clock, so this wait is the input.
    await page.waitForTimeout(700);
    await touch("touchEnd", [{ id: 1, x: 400, y: 150 }]);
    expect(await settledFrom(page)).toBeCloseTo(reference, 1);
  });
});
