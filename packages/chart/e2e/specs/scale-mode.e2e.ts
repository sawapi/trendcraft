import { expect, test } from "@playwright/test";
import { openChart } from "./helpers";

test.describe("scale mode", () => {
  test('a "percent" scale mode warns instead of rendering silently as linear (ops #48)', async ({
    page,
  }) => {
    await openChart(page);
    const messages = await page.evaluate(() => {
      const { chart } = window.__tc;
      const seen: string[] = [];
      chart.on("error", (e) => seen.push((e as { message: string }).message));
      chart.setLayout({ panes: [{ id: "main", flex: 3, leftScale: { mode: "percent" } }] });
      return seen;
    });
    expect(messages.some((m) => m.includes('"percent"'))).toBe(true);
  });
});
