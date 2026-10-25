import { expect, test } from "@playwright/test";
import { logicalRange, openChart } from "./helpers";

test.describe("animation", () => {
  test("a visible-range change started from a visibleRangeChange listener lands (ops #26)", async ({
    page,
  }) => {
    await openChart(page);
    await page.evaluate(() => {
      const { chart, candles } = window.__tc;
      let first = true;
      chart.on("visibleRangeChange", () => {
        if (!first) return;
        first = false;
        chart.setVisibleRange(candles[200].time, candles[250].time);
      });
      chart.setVisibleRange(candles[0].time, candles[50].time);
    });
    // The second animation, started inside the first one's completion, used to
    // be dropped: the view stayed on bars 0-50.
    await expect.poll(async () => Math.round((await logicalRange(page)).from)).toBe(200);
  });
});
