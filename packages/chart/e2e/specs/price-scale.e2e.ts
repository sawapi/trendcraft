import { expect, type Page, test } from "@playwright/test";
import { openChart } from "./helpers";

/** Snapshot of the chart canvas' pixels. */
async function pixels(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector("#chart canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  });
}

/**
 * Share of the pixels painted in `a` (anything off the background) that are
 * the same in `b`. A wrong price scale moves or removes every candle, so
 * almost none survive; drawing one more line over the chart keeps most. A
 * whole-canvas changed-pixel share cannot tell: candles cover only a few
 * percent of the canvas, so even a blank chart changes little of it.
 */
function retainedShare(a: number[], b: number[]): number {
  let painted = 0;
  let kept = 0;
  for (let i = 0; i < a.length; i += 4) {
    const offBackground =
      Math.abs(a[i] - 0x13) + Math.abs(a[i + 1] - 0x17) + Math.abs(a[i + 2] - 0x22) > 30;
    if (!offBackground) continue;
    painted++;
    if (
      Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) <=
      30
    ) {
      kept++;
    }
  }
  return kept / painted;
}

const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

test.describe("price range", () => {
  test("a non-finite high in a live update does not blank the chart (ops #31)", async ({
    page,
  }) => {
    await openChart(page, "?volume=0");
    const before = await pixels(page);
    await page.evaluate(() => {
      const { chart, candles } = window.__tc;
      const last = candles[candles.length - 1];
      chart.updateCandle({ ...last, time: last.time + 86_400_000, high: Number.POSITIVE_INFINITY });
    });
    await page.evaluate(twoFrames);
    // The bad bar is rejected, so the chart is unchanged.
    expect(retainedShare(before, await pixels(page))).toBeGreaterThan(0.95);
  });

  test("a non-finite value in an indicator does not blank the chart (ops #31)", async ({
    page,
  }) => {
    await openChart(page, "?volume=0");
    const before = await pixels(page);
    await page.evaluate(() => {
      const { chart, candles } = window.__tc;
      // A main-pane overlay with one Infinity inside the initial view (bars
      // ~207-299): the range reducers must skip it, so the candles keep their
      // scale and only the line and its legend row are added.
      chart.addIndicator(
        candles.map((c, i) => ({
          time: c.time,
          value: i === 290 ? Number.POSITIVE_INFINITY : c.close,
        })),
        { pane: "main", label: "Close" },
      );
    });
    await page.evaluate(twoFrames);
    // ~0.95 when fixed (the line covers a few candle pixels); a broken scale
    // leaves only the grid and axis, about 0.3-0.45.
    expect(retainedShare(before, await pixels(page))).toBeGreaterThan(0.85);
  });
});
