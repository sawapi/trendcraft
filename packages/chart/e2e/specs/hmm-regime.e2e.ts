import { expect, test } from "@playwright/test";
import { openChart } from "./helpers";

test.describe("hmmRegime", () => {
  test("an hmmRegimes() series draws in its pane", async ({ page }) => {
    await openChart(page, "?volume=0");
    const painted = await page.evaluate(async () => {
      const { chart, candles } = window.__tc;
      const canvas = document.querySelector("#chart canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const purple = () => {
        // The hmmRegime preset colour family (purple): r and b well above g.
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 110 && data[i + 2] > 140 && data[i + 1] < data[i] - 40) n++;
        }
        return n;
      };
      const before = purple();
      chart.addIndicator(
        candles.map((c, i) => ({
          time: c.time,
          value: {
            regime: Math.floor(i / 40) % 3,
            label: "s",
            probabilities: [0.2, 0.3, 0.5],
            logLikelihood: -1,
          },
        })),
      );
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { before, after: purple() };
    });
    expect(painted.after - painted.before).toBeGreaterThan(200);
  });
});
