import { expect, type Page, test } from "@playwright/test";
import { frames } from "./helpers";

// A canvas's CSS box is either set by the page's CSS or, with none, taken
// from its bitmap size. The sparkline writes a DPR-scaled bitmap, so it pins
// an inline px size only in the second case; pinning a CSS-sized canvas
// froze it at the width measured at first render (ops #123).
test.use({ deviceScaleFactor: 2 });

const DATA = [1, 3, 2, 5, 4, 6, 5, 7];

async function openSparkline(page: Page): Promise<void> {
  await page.goto("/sparkline.html");
  await page.waitForFunction(() => window.__spark?.ready === true);
}

/** Mount a container (inline style `css`) holding one canvas; return nothing. */
async function mount(page: Page, css: string, canvasAttrs: Record<string, string> = {}) {
  await page.evaluate(
    ({ css, canvasAttrs }) => {
      const box = document.createElement("div");
      box.id = "box";
      box.style.cssText = css;
      const canvas = document.createElement("canvas");
      canvas.id = "spark";
      for (const [k, v] of Object.entries(canvasAttrs)) canvas.setAttribute(k, v);
      box.appendChild(canvas);
      document.body.appendChild(box);
    },
    { css, canvasAttrs },
  );
}

const rect = (page: Page) =>
  page.evaluate(() => {
    const c = document.getElementById("spark") as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { w: r.width, h: r.height, bw: c.width, bh: c.height, style: c.style.cssText };
  });

test.describe("sparkline sizing", () => {
  test("a stylesheet-sized canvas follows its container", async ({ page }) => {
    await openSparkline(page);
    await mount(page, "width:200px", { class: "fluid" });
    await page.evaluate(() => {
      (window as unknown as { h: unknown }).h = window.__spark.createSparkline(
        document.getElementById("spark") as HTMLCanvasElement,
        { type: "line", data: [1, 3, 2, 5, 4, 6, 5, 7] },
      );
    });
    expect(await rect(page)).toMatchObject({ w: 200, h: 30, bw: 400, bh: 60 });

    await page.evaluate(() => {
      (document.getElementById("box") as HTMLElement).style.width = "400px";
    });
    await frames(page, 2);
    expect((await rect(page)).w).toBe(400);
    // A render then sizes the bitmap to the new box.
    await page.evaluate(() => (window as unknown as { h: { render(): void } }).h.render());
    expect(await rect(page)).toMatchObject({ w: 400, bw: 800 });
  });

  test("a stylesheet-sized canvas hidden at first render takes its box when shown", async ({
    page,
  }) => {
    await openSparkline(page);
    await mount(page, "width:240px;display:none", { class: "fluid" });
    await page.evaluate(() => {
      window.__spark.createSparkline(document.getElementById("spark") as HTMLCanvasElement, {
        type: "line",
        data: [1, 3, 2, 5, 4, 6, 5, 7],
      });
      (document.getElementById("box") as HTMLElement).style.display = "block";
    });
    await frames(page, 3);
    expect(await rect(page)).toMatchObject({ w: 240, h: 30, bw: 480, bh: 60 });
  });

  test("a canvas with no CSS size keeps its CSS size, not its DPR-scaled bitmap", async ({
    page,
  }) => {
    await openSparkline(page);
    await mount(page, "", { width: "80", height: "30" });
    await page.evaluate((data) => {
      const h = window.__spark.createSparkline(
        document.getElementById("spark") as HTMLCanvasElement,
        { type: "line", data },
      );
      for (let i = 0; i < 3; i++) h.render();
    }, DATA);
    expect(await rect(page)).toMatchObject({ w: 80, h: 30, bw: 160, bh: 60 });
  });

  test("a canvas with no CSS size hidden at first render keeps its CSS size when shown", async ({
    page,
  }) => {
    await openSparkline(page);
    await mount(page, "display:none", { width: "80", height: "30" });
    await page.evaluate((data) => {
      window.__spark.createSparkline(document.getElementById("spark") as HTMLCanvasElement, {
        type: "line",
        data,
      });
      (document.getElementById("box") as HTMLElement).style.display = "block";
    }, DATA);
    await frames(page, 3);
    expect(await rect(page)).toMatchObject({ w: 80, h: 30, bw: 160, bh: 60 });
  });

  test("destroy() removes the inline size it added", async ({ page }) => {
    await openSparkline(page);
    await mount(page, "", { width: "80", height: "30" });
    const style = await page.evaluate((data) => {
      const canvas = document.getElementById("spark") as HTMLCanvasElement;
      window.__spark.createSparkline(canvas, { type: "line", data }).destroy();
      return canvas.style.cssText;
    }, DATA);
    expect(style).toBe("");
  });
});
