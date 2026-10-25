import { expect, test } from "@playwright/test";
import { chartBox, openChart } from "./helpers";

test.describe("rendering", () => {
  test("paints candles: the canvas is not blank and shows both candle colours", async ({
    page,
  }) => {
    // Without the volume pane, which uses the same up/down colours, so only
    // candles can supply them.
    await openChart(page, "?volume=0");
    const stats = await page.evaluate(() => {
      const canvas = document.querySelector("#chart canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonBackground = 0;
      let greenish = 0;
      let reddish = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (Math.abs(r - 0x13) + Math.abs(g - 0x17) + Math.abs(b - 0x22) > 30) nonBackground++;
        if (g > 120 && g > r + 40) greenish++;
        if (r > 150 && r > g + 60) reddish++;
      }
      return { nonBackground, greenish, reddish, total: data.length / 4 };
    });
    expect(stats.nonBackground / stats.total).toBeGreaterThan(0.02);
    expect(stats.greenish).toBeGreaterThan(100);
    expect(stats.reddish).toBeGreaterThan(100);
  });

  test("reports a visible range inside the data", async ({ page }) => {
    await openChart(page);
    const range = await page.evaluate(() => window.__tc.chart.getVisibleRange());
    expect(range).not.toBeNull();
    const r = range as { startIndex: number; endIndex: number };
    expect(r.startIndex).toBeGreaterThanOrEqual(0);
    expect(r.endIndex).toBeLessThanOrEqual(299);
    expect(r.endIndex).toBeGreaterThan(r.startIndex);
  });

  test("fills the container", async ({ page }) => {
    await openChart(page);
    const box = await chartBox(page);
    expect(box.width).toBeGreaterThan(700);
    expect(box.height).toBeGreaterThan(400);
  });
});
