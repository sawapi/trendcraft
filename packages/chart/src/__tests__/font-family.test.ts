// @vitest-environment happy-dom
/**
 * fontFamily option — create-time + applyOptions wiring into canvas text.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { canvasFont, DEFAULT_FONT_FAMILY } from "../core/font";
import { DARK_THEME } from "../core/types";
import { createChart } from "../index";
import { renderPriceAxis } from "../renderer/axis-renderer";
import { makePriceScale, mockCtx } from "./helpers/mock-ctx";

describe("canvasFont", () => {
  it("formats regular and bold fonts with the default family", () => {
    expect(canvasFont(11)).toBe(`11px ${DEFAULT_FONT_FAMILY}`);
    expect(canvasFont(11, DEFAULT_FONT_FAMILY)).toBe(`11px ${DEFAULT_FONT_FAMILY}`);
    expect(canvasFont(11, DEFAULT_FONT_FAMILY, "bold")).toBe(`bold 11px ${DEFAULT_FONT_FAMILY}`);
  });

  it("falls back to the default stack when family is empty", () => {
    expect(canvasFont(11, "")).toBe(`11px ${DEFAULT_FONT_FAMILY}`);
  });
});

describe("renderPriceAxis fontFamily", () => {
  it("uses the default system stack when fontFamily is omitted", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(), 740, 0, 60, 300, DARK_THEME, 11);
    expect(ctx.font).toBe(`11px ${DEFAULT_FONT_FAMILY}`);
  });

  it("uses an explicit fontFamily matching the default in ctx.font", () => {
    const ctx = mockCtx();
    renderPriceAxis(
      ctx,
      makePriceScale(),
      740,
      0,
      60,
      300,
      DARK_THEME,
      11,
      undefined,
      {},
      DEFAULT_FONT_FAMILY,
    );
    expect(ctx.font).toBe(`11px ${DEFAULT_FONT_FAMILY}`);
  });
});

describe("createChart fontFamily", () => {
  let lastFont = "";

  beforeAll(() => {
    const noop = () => {};
    const context2d = new Proxy(
      { font: "" },
      {
        get: (t, prop) => {
          if (prop === "font") return t.font;
          if (prop === "canvas") return null;
          if (prop === "measureText") return () => ({ width: 40 }) as TextMetrics;
          return noop;
        },
        set: (t, prop, value) => {
          if (prop === "font") {
            t.font = value as string;
            lastFont = value as string;
          }
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
      context2d;
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    lastFont = "";
  });

  function makeContainer(): HTMLElement {
    const el = document.createElement("div");
    el.style.width = "800px";
    el.style.height = "400px";
    document.body.appendChild(el);
    return el;
  }

  async function flushFrames(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  it("passes create-time fontFamily into canvas axis text", async () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      fontSize: 11,
      fontFamily: DEFAULT_FONT_FAMILY,
      volume: false,
      legend: false,
    });
    chart.setCandles([
      { time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: 1_700_000_060, open: 105, high: 115, low: 100, close: 112, volume: 1200 },
      { time: 1_700_000_120, open: 112, high: 120, low: 108, close: 118, volume: 1100 },
    ]);
    await flushFrames();

    expect(lastFont).toContain(DEFAULT_FONT_FAMILY);
    expect(lastFont).toMatch(/^11px /);
    chart.destroy();
  });

  it("defaults to the historical system stack when fontFamily is omitted", async () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      volume: false,
      legend: false,
    });
    chart.setCandles([
      { time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: 1_700_000_060, open: 105, high: 115, low: 100, close: 112, volume: 1200 },
    ]);
    await flushFrames();

    expect(lastFont).toContain(DEFAULT_FONT_FAMILY);
    expect(lastFont).toMatch(/^11px /);
    chart.destroy();
  });

  it("updates DOM legend fontFamily via applyOptions", () => {
    const container = makeContainer();
    const chart = createChart(container, { legend: true, width: 800, height: 400 });
    const legend = container.querySelector(".tc-legend") as HTMLElement;
    expect(legend.style.fontFamily).toBe(DEFAULT_FONT_FAMILY);

    chart.applyOptions({ fontFamily: DEFAULT_FONT_FAMILY });
    expect(legend.style.fontFamily).toBe(DEFAULT_FONT_FAMILY);
    chart.destroy();
  });
});
