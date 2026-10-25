import { expect, test } from "@playwright/test";
import { openChart } from "./helpers";

// LIGHT_THEME.text and DARK_THEME.text (src/core/types/theme.ts).
const LIGHT_TEXT = "rgb(19, 23, 34)";
const DARK_TEXT = "rgb(209, 212, 220)";

test.describe("theme", () => {
  test("switching theme recolours the legend text", async ({ page }) => {
    await openChart(page);
    await page.evaluate(() => {
      const { chart, candles } = window.__tc;
      chart.addIndicator(
        candles.map((c) => ({ time: c.time, value: c.close })),
        { pane: "main", label: "Close" },
      );
    });
    const row = page.locator(".tc-legend-row").first();
    await expect(row).toHaveCSS("color", DARK_TEXT);

    await page.evaluate(() => window.__tc.chart.setTheme("light"));
    await expect(row).toHaveCSS("color", LIGHT_TEXT);

    await page.evaluate(() => window.__tc.chart.setTheme("dark"));
    await expect(row).toHaveCSS("color", DARK_TEXT);
  });
});
