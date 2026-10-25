// @vitest-environment happy-dom
/**
 * Theme colours are caller-supplied (an app may load user-made themes), and
 * the info overlay writes them into `style` attributes through innerHTML. A
 * colour containing `"` must stay inside its attribute rather than open new
 * markup.
 */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { DARK_THEME } from "../core/types/theme";
import { InfoOverlay } from "../renderer/info-overlay";

const HOSTILE = '"><img id="pwn">';

describe("InfoOverlay escapes theme colours", () => {
  it("does not let a theme colour inject elements into the main pane info", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const theme = {
      ...DARK_THEME,
      text: HOSTILE,
      textSecondary: HOSTILE,
      upColor: HOSTILE,
      downColor: HOSTILE,
    };
    const overlay = new InfoOverlay(container, theme);
    const candles = [{ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];
    const objectSeries = {
      id: "s1",
      paneId: "main",
      visible: true,
      config: { label: "BB", color: "#fff" },
      data: [{ time: 1000, value: { upper: 3, middle: 2, lower: 1 } }],
    } as unknown as InternalSeries;

    overlay.update(0, candles, [], new Map([["main", [objectSeries]]]));

    expect(container.querySelector("#pwn")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    // The OHLC values are still rendered.
    expect(container.textContent).toContain("1.5");
    // ...and so is the object-valued series, whose value span also takes the theme text colour.
    expect(container.textContent).toContain("upper:");
  });
});
