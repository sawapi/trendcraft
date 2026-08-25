// @vitest-environment happy-dom
/**
 * Sparkline sizing when the canvas has no layout box.
 *
 * `setupCanvas` writes the bitmap size as `cssSize * devicePixelRatio`. If it
 * also *reads* that bitmap back as a CSS size — which it did, via the
 * `canvas.width` fallback — every render of a canvas with no layout box
 * (display:none, a collapsed panel, not yet attached) multiplies the bitmap by
 * the DPR again, compounding without bound.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSparkline } from "../sparkline";

/** Canvases whose getBoundingClientRect should report a zero-sized box. */
const hidden = new Set<HTMLElement>();
/** CSS box reported for a laid-out canvas. */
const boxes = new Map<HTMLElement, { width: number; height: number }>();

beforeAll(() => {
  const noop = () => {};
  const context2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    context2d;

  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    const box = hidden.has(el)
      ? { width: 0, height: 0 }
      : (boxes.get(el) ?? { width: 0, height: 0 });
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: box.width,
      height: box.height,
      bottom: box.height,
      right: box.width,
      toJSON: () => ({}),
    } as DOMRect;
  };

  // happy-dom derives clientWidth/clientHeight from layout it does not run.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return hidden.has(this) ? 0 : (boxes.get(this)?.width ?? 0);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return hidden.has(this) ? 0 : (boxes.get(this)?.height ?? 0);
    },
  });
});

function makeCanvas(box?: { width: number; height: number }): HTMLCanvasElement {
  const wrapper = document.createElement("div");
  const canvas = document.createElement("canvas");
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);
  if (box) boxes.set(canvas, box);
  return canvas;
}

const data = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3];

describe("sparkline sizing without a layout box", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    hidden.clear();
    boxes.clear();
    (window as unknown as { devicePixelRatio: number }).devicePixelRatio = 2;
  });

  it("keeps the bitmap fixed while the canvas is hidden", () => {
    const canvas = makeCanvas({ width: 80, height: 30 });
    const handle = createSparkline(canvas, { type: "line", data });

    expect(canvas.width).toBe(160); // 80 css * dpr 2
    expect(canvas.height).toBe(60);

    hidden.add(canvas);
    for (let i = 0; i < 8; i++) handle.update({ data });

    // Previously: 160 -> 320 -> ... -> 40960 over these 8 updates.
    expect(canvas.width).toBe(160);
    expect(canvas.height).toBe(60);

    handle.destroy();
  });

  it("keeps the bitmap fixed for a canvas that is never laid out", () => {
    const canvas = makeCanvas();
    const handle = createSparkline(canvas, { type: "line", data });

    // No layout box and no author-declared size: the 80x30 fallback applies.
    expect(canvas.width).toBe(160);
    for (let i = 0; i < 8; i++) handle.render();
    expect(canvas.width).toBe(160);
    expect(canvas.height).toBe(60);

    handle.destroy();
  });

  it("honors an author-declared size when there is no layout box", () => {
    const canvas = makeCanvas();
    canvas.setAttribute("width", "120");
    canvas.setAttribute("height", "40");
    const handle = createSparkline(canvas, { type: "line", data });

    expect(canvas.width).toBe(240); // 120 css * dpr 2
    expect(canvas.height).toBe(80);
    for (let i = 0; i < 5; i++) handle.render();
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(80);

    handle.destroy();
  });

  it("resizes to the real box when a hidden canvas becomes visible", () => {
    const canvas = makeCanvas({ width: 80, height: 30 });
    const handle = createSparkline(canvas, { type: "line", data });
    hidden.add(canvas);
    handle.render();

    hidden.delete(canvas);
    boxes.set(canvas, { width: 200, height: 50 });
    handle.render();

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(100);

    handle.destroy();
  });

  it("does not compound at a fractional device pixel ratio", () => {
    (window as unknown as { devicePixelRatio: number }).devicePixelRatio = 1.5;
    const canvas = makeCanvas({ width: 80, height: 30 });
    const handle = createSparkline(canvas, { type: "line", data });
    expect(canvas.width).toBe(120);

    hidden.add(canvas);
    for (let i = 0; i < 10; i++) handle.render();
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(45);

    handle.destroy();
  });
});
