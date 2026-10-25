import { expect, type Page } from "@playwright/test";

/** Open the fixture and wait until the chart has painted. */
export async function openChart(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__tc?.ready === true);
}

/** The visible logical range, read through the public API. */
export async function logicalRange(page: Page): Promise<{ from: number; to: number }> {
  const range = await page.evaluate(() => window.__tc.chart.getVisibleLogicalRange());
  expect(range).not.toBeNull();
  return range as { from: number; to: number };
}

/** Bounding box of the main chart canvas, in page coordinates. */
export async function chartBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator("#chart canvas").first().boundingBox();
  expect(box).not.toBeNull();
  return box as { x: number; y: number; width: number; height: number };
}

/** Resolve after `n` animation frames in the page (frame-paced, not wall-clock). */
export async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/** True when the visible range moves at all across the next few frames. */
export async function isMoving(page: Page): Promise<boolean> {
  const a = await logicalRange(page);
  await frames(page, 3);
  const b = await logicalRange(page);
  return Math.abs(b.from - a.from) > 0.01;
}

/**
 * True when the view is flinging inside the data: moving faster than an
 * overscroll spring-back can (more than 0.3 bars over 3 frames; a bounce peaks
 * near 1 bar in total) and not overscrolled past the first bar. `isMoving`
 * alone also accepts a bounce at the data edge, which is not a fling.
 *
 * Checks the left edge only, so it is valid for flings toward the past
 * (negative deltaX). The fixture opens at the right end of the data, where a
 * positive-deltaX flick overscrolls at once and its spring-back can exceed
 * the rate threshold: add a right-edge check before using it that way.
 */
export async function isFlinging(page: Page): Promise<boolean> {
  const a = await logicalRange(page);
  await frames(page, 3);
  const b = await logicalRange(page);
  return Math.abs(b.from - a.from) > 0.3 && Math.min(a.from, b.from) > 1;
}

/**
 * A horizontal trackpad flick over the chart: eight wheel events 16 ms apart,
 * dispatched inside the page so their spacing does not depend on the test
 * runner's round trips. The wheel session ends 150 ms after the last event
 * and hands its velocity to the pan-inertia loop.
 *
 * Keep the flick small enough that neither the events nor the fling reach
 * the end of the data: on the default fixture -40 moves the view ~40 bars
 * and the fling ~20 more, from bar ~207. A large flick hits the left edge,
 * where the fling stops at once and nothing is left to observe. Use a
 * negative deltaX (toward the past): `isFlinging` guards the left edge only.
 */
export async function wheelFlick(page: Page, deltaX = -40): Promise<void> {
  await page.evaluate(
    (dx) =>
      new Promise<void>((resolve) => {
        const canvas = document.querySelector("#chart canvas") as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        let sent = 0;
        const send = () => {
          canvas.dispatchEvent(
            new WheelEvent("wheel", {
              deltaX: dx,
              deltaY: 0,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 3,
              bubbles: true,
              cancelable: true,
            }),
          );
          if (++sent < 8) setTimeout(send, 16);
          else resolve();
        };
        send();
      }),
    deltaX,
  );
  // The events alone must leave the view inside the data, or the fling starts
  // at the edge, stops at once, and only a spring-back is left to observe.
  expect(
    (await logicalRange(page)).from,
    "wheelFlick pushed the view to the start of the data; use a smaller deltaX",
  ).toBeGreaterThan(1);
}
