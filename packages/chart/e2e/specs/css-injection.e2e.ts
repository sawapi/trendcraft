import { expect, test } from "@playwright/test";
import { DARK_THEME } from "../../src/core/types/theme";
import { chartBox, frames, openChart } from "./helpers";

// Colours are caller-supplied (an app may let users build themes or pick
// series colours) and end up in `style` attributes of the legend and info
// overlay. A value that is not a colour must not add CSS declarations: these
// would make the viewer's browser fetch an arbitrary URL (ops #121).
const EXFIL = "/tc-css-exfil/";
const EXTRA_DECLARATION = `red;background-image:url(${EXFIL}decl)`;
const BARE_URL = `url(${EXFIL}bare)`;
// Substitution functions pass a parse-time colour check whatever their
// fallback holds, so these must be rejected too.
const VAR_FALLBACK = `var(--tc-none, url(${EXFIL}var))`;
const ENV_FALLBACK = `env(tc-none, url(${EXFIL}env))`;

test.describe("CSS injection through colours", () => {
  test("hostile theme and series colours add no declarations and fetch nothing", async ({
    page,
  }) => {
    const fetched: string[] = [];
    await page.route(`**${EXFIL}**`, (route) => {
      fetched.push(route.request().url());
      return route.fulfill({ status: 204 });
    });
    await openChart(page);

    await page.evaluate(
      ({ decl, series, base }) => {
        const { chart, candles } = window.__tc;
        // `background:` on the legend dot takes a bare url() with no `;`.
        for (const [label, color] of series) {
          chart.addIndicator(
            candles.map((c) => ({ time: c.time, value: c.close })),
            { pane: "main", label, color },
          );
        }
        chart.setTheme({
          ...base,
          text: decl,
          textSecondary: decl,
          upColor: decl,
          downColor: decl,
        });
      },
      {
        decl: EXTRA_DECLARATION,
        series: [
          ["Bare", BARE_URL],
          ["Decl", EXTRA_DECLARATION],
          ["Var", VAR_FALLBACK],
          ["Env", ENV_FALLBACK],
        ],
        base: DARK_THEME,
      },
    );

    // Hover so the info overlay renders OHLC values and series values too.
    const box = await chartBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await expect(page.locator(".tc-legend-row")).toHaveCount(4);
    await expect(page.locator(".tc-info").first()).toContainText("Decl");
    await frames(page, 5);

    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#chart *")]
        .filter((el) => getComputedStyle(el).backgroundImage !== "none")
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(offenders).toEqual([]);
    expect(fetched).toEqual([]);
  });

  test("an unparseable series colour falls back to the theme text colour", async ({ page }) => {
    await openChart(page);
    await page.evaluate(() => {
      const { chart, candles } = window.__tc;
      chart.addIndicator(
        candles.map((c) => ({ time: c.time, value: c.close })),
        { pane: "main", label: "Typo", color: "#12345" },
      );
    });
    // DARK_THEME.text (src/core/types/theme.ts).
    await expect(page.locator(".tc-legend-dot").first()).toHaveCSS(
      "background-color",
      "rgb(209, 212, 220)",
    );
  });
});
