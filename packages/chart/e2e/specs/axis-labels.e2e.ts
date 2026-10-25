import { expect, type Page, test } from "@playwright/test";
import { logicalRange, openChart } from "./helpers";

type Label = { text: string; left: number; right: number; y: number };

/**
 * Record the time-axis labels of the next frame: every fillText in the band
 * below the plot, with its drawn extent from the real font metrics.
 */
async function axisLabels(page: Page): Promise<Label[]> {
  return page.evaluate(async () => {
    const canvas = document.querySelector("#chart canvas") as HTMLCanvasElement;
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.fillText;
    const seen: Array<{ text: string; left: number; right: number; y: number }> = [];
    proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number) {
      const w = this.measureText(text).width;
      const left = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" ? x - w : x;
      seen.push({ text, left, right: left + w, y });
      return original.call(this, text, x, y);
    };
    // Force a repaint by nudging the view by zero.
    const r = window.__tc.chart.getVisibleLogicalRange();
    if (r) window.__tc.chart.setVisibleLogicalRange(r.from, r.to);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    proto.fillText = original;
    // The time axis sits below the plot area: the bottom ~40 px of the canvas,
    // excluding the price-axis column on the right.
    const dpr = window.devicePixelRatio;
    const bottom = canvas.height / dpr;
    return seen.filter((l) => l.y > bottom - 45 && l.left < canvas.width / dpr - 70);
  });
}

function overlaps(labels: Label[]): string[] {
  const rows = new Map<number, Label[]>();
  for (const l of labels) rows.set(Math.round(l.y), [...(rows.get(Math.round(l.y)) ?? []), l]);
  const bad: string[] = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.left - b.left);
    for (let i = 1; i < row.length; i++) {
      if (row[i].left < row[i - 1].right) bad.push(`"${row[i - 1].text}" / "${row[i].text}"`);
    }
  }
  return bad;
}

/** 5-minute bars whose sessions start at irregular times, as real data does. */
async function loadIntraday(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bars = [];
    let t = Date.UTC(2024, 10, 15, 13, 7);
    for (let i = 0; i < 600; i++) {
      bars.push({ time: t, open: 100, high: 101, low: 99, close: 100, volume: 1000 });
      t += i % 78 === 77 ? 17 * 3_600_000 + 13 * 60_000 : 5 * 60_000;
    }
    window.__tc.chart.setCandles(bars);
  });
}

/** Overlaps found across 40 start offsets, after each range change has settled. */
async function overlapsAcrossOffsets(page: Page, minRows: number, span: number): Promise<string[]> {
  const found: string[] = [];
  for (let start = 0; start < 40; start++) {
    await page.evaluate(
      ([s, w]) => window.__tc.chart.setVisibleLogicalRange(300 + s, 300 + s + w),
      [start, span],
    );
    // The range change animates: capture only once the view has arrived,
    // or every start offset measures the same mid-animation frame.
    await expect
      .poll(async () => (await logicalRange(page)).from, { intervals: [50] })
      .toBeCloseTo(300 + start, 1);
    const labels = await axisLabels(page);
    const rows = new Map<number, number>();
    for (const l of labels) rows.set(Math.round(l.y), (rows.get(Math.round(l.y)) ?? 0) + 1);
    expect(rows.size, `axis rows at start ${start}`).toBeGreaterThanOrEqual(minRows);
    for (const [y, n] of rows)
      expect(n, `labels in row y=${y} at start ${start}`).toBeGreaterThan(1);
    found.push(...overlaps(labels).map((o) => `start ${start}: ${o}`));
  }
  return found;
}

test.describe("time axis labels", () => {
  test("single-row axis: labels never overlap, at any start offset", async ({ page }) => {
    await openChart(page, "?volume=0");
    await loadIntraday(page);
    expect(await overlapsAcrossOffsets(page, 1, 80)).toEqual([]);
  });

  test("two-row axis: neither row overlaps, at any start offset", async ({ page }) => {
    // The time-proportional layout puts intraday data on the two-row axis
    // (times above, dates below). A 200-bar view spans 2-3 sessions, so the
    // date row carries more than one label.
    await openChart(page, "?volume=0&sessionGaps=1");
    await loadIntraday(page);
    expect(await overlapsAcrossOffsets(page, 2, 200)).toEqual([]);
  });
});
