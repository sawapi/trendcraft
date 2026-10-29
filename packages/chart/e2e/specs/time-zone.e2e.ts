import { type Browser, expect, type Page, test } from "@playwright/test";
import { chartBox, frames, openChart } from "./helpers";

// The time axis and the crosshair label used to read the browser's zone, so
// one bar showed different dates on different machines and in an app that
// formats its own panel in another zone. With `timeZone` set, both
// read that zone wherever the browser is.

/** 5-minute bars over three US sessions (09:30–16:00 New York, 14:30Z). */
async function loadUsSessions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bars = [];
    for (let day = 0; day < 3; day++) {
      const open = Date.UTC(2024, 10, 13 + day, 14, 30);
      for (let i = 0; i < 78; i++) {
        bars.push({
          time: open + i * 300_000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1,
        });
      }
    }
    window.__tc.chart.setCandles(bars);
    window.__tc.chart.applyOptions({ timeZone: "America/New_York" });
  });
}

/** Every fillText of the next two frames. */
async function drawnText(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.fillText;
    const seen: string[] = [];
    proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number) {
      seen.push(text);
      return original.call(this, text, x, y);
    };
    const r = window.__tc.chart.getVisibleLogicalRange();
    if (r) window.__tc.chart.setVisibleLogicalRange(r.from, r.to);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    proto.fillText = original;
    return seen;
  });
}

/** Open the fixture in a browser whose own zone is `timezoneId`; hover bar `index`'s column. */
async function labelsIn(browser: Browser, timezoneId: string, query: string) {
  const context = await browser.newContext({ timezoneId, viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  await openChart(page, query);
  await loadUsSessions(page);
  await page.evaluate(() => window.__tc.chart.setVisibleLogicalRange(60, 160));
  await frames(page, 30);
  const box = await chartBox(page);
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 3);
  await frames(page, 2);
  const hovered = await page.evaluate(() => {
    const moves = window.__tc.events.filter((e) => e.type === "crosshairMove");
    const last = moves.at(-1)?.data as { time: number | null } | undefined;
    return last?.time ?? null;
  });
  const text = await drawnText(page);
  await context.close();
  return { hovered, text };
}

test.describe("time zone", () => {
  for (const [name, query] of [
    ["single-row axis", "?volume=0"],
    ["two-row axis", "?volume=0&sessionGaps=1"],
  ] as const) {
    test(`${name}: labels follow timeZone, not the browser's zone`, async ({ browser }) => {
      const tokyo = await labelsIn(browser, "Asia/Tokyo", query);
      const newYork = await labelsIn(browser, "America/New_York", query);

      // Same bar hovered, and every label identical, in both browser zones.
      expect(tokyo.hovered).not.toBeNull();
      expect(tokyo.hovered).toBe(newYork.hovered);
      expect(tokyo.text).toEqual(newYork.text);

      // The crosshair label is the bar's New York wall clock.
      const expected = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(tokyo.hovered as number);
      expect(tokyo.text).toContain(expected);
    });
  }

  // Daily bars stamped at 00:00 UTC read 09:00 in Tokyo and 19:00 the day
  // before in New York. That hour is a time-zone artifact, so the crosshair,
  // like the axis, shows the date alone (in the browser's zone by default).
  for (const timezoneId of ["Asia/Tokyo", "America/New_York"]) {
    test(`daily crosshair label in ${timezoneId} has no time`, async ({ browser }) => {
      const context = await browser.newContext({
        timezoneId,
        viewport: { width: 1000, height: 700 },
      });
      const page = await context.newPage();
      await openChart(page, "?volume=0");
      await page.evaluate(() => {
        const bars = [];
        for (let i = 0; i < 120; i++) {
          bars.push({
            time: Date.UTC(2024, 0, 1) + i * 86_400_000,
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 1,
          });
        }
        window.__tc.chart.setCandles(bars);
      });
      await frames(page, 30);
      const box = await chartBox(page);
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 3);
      await frames(page, 2);
      const hovered = await page.evaluate(() => {
        const moves = window.__tc.events.filter((e) => e.type === "crosshairMove");
        return (moves.at(-1)?.data as { time: number | null } | undefined)?.time ?? null;
      });
      expect(hovered).not.toBeNull();
      const text = await drawnText(page);
      await context.close();

      const label = new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezoneId,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(hovered as number);
      expect(text).toContain(label);
      expect(text.some((t) => t.startsWith(`${label} `))).toBe(false);
    });
  }

  test("an unknown zone is ignored with a warning", async ({ page }) => {
    await openChart(page, "?volume=0");
    const codes = await page.evaluate(() => {
      const seen: string[] = [];
      window.__tc.chart.on("error", (e) => seen.push((e as { code: string }).code));
      window.__tc.chart.applyOptions({ timeZone: "Mars/Olympus_Mons" });
      return seen;
    });
    expect(codes).toEqual(["INVALID_OPTION"]);
  });
});
