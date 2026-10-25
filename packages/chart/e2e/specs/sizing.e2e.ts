import { expect, test } from "@playwright/test";
import { frames, logicalRange, openChart } from "./helpers";

test.describe("chart sizing", () => {
  // A zero-width data area has no window to measure. It once collapsed the
  // window to nothing, so a live view stopped counting as at the end and
  // bars appended meanwhile stayed off-screen after the chart grew back.
  for (const width of [0, 40]) {
    test(`a live view keeps following through a ${width}px-wide resize`, async ({ page }) => {
      await openChart(page, "?volume=0");
      const before = await logicalRange(page);
      const bars = await page.evaluate(() => window.__tc.candles.length);
      expect(before.to).toBeCloseTo(bars, 3);

      await page.evaluate((w) => window.__tc.chart.resize(w, 500), width);
      await frames(page, 2);
      await page.evaluate(() => {
        const { chart, candles } = window.__tc;
        const last = candles[candles.length - 1];
        for (let i = 1; i <= 3; i++)
          chart.updateCandle({ ...last, time: last.time + i * 86_400_000 });
      });
      await frames(page, 2);
      await page.evaluate(() => window.__tc.chart.resize(800, 500));
      await frames(page, 2);

      const after = await logicalRange(page);
      expect(after.to).toBeCloseTo(bars + 3, 3);
      expect(after.to - after.from).toBeCloseTo(before.to - before.from, 3);
    });
  }

  // A range requested while there is no width to fit it into is ignored,
  // like setVisibleLogicalRange and fitContent; setVisibleRange used to
  // collapse the window and zoom to the minimum spacing.
  for (const setter of ["setVisibleRange", "setVisibleLogicalRange"] as const) {
    test(`${setter} at zero width leaves the window as it was`, async ({ page }) => {
      await openChart(page, "?volume=0");
      const before = await logicalRange(page);
      await page.evaluate(() => window.__tc.chart.resize(0, 500));
      await frames(page, 2);
      await page.evaluate((setter) => {
        const { chart, candles } = window.__tc;
        if (setter === "setVisibleRange")
          chart.setVisibleRange(candles[100].time, candles[180].time);
        else chart.setVisibleLogicalRange(100, 180);
      }, setter);
      await frames(page, 30);
      await page.evaluate(() => window.__tc.chart.resize(800, 500));
      await frames(page, 2);
      const after = await logicalRange(page);
      expect(after.from).toBeCloseTo(before.from, 3);
      expect(after.to - after.from).toBeCloseTo(before.to - before.from, 3);
    });
  }
});
