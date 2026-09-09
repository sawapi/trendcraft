// @vitest-environment happy-dom
/**
 * Sparkline framework wrappers — repaint on `width` / `height` prop change.
 *
 * Both wrappers used to write the props straight onto the `<canvas>`
 * `width`/`height` attributes. Per the HTML spec, assigning either attribute
 * resets the bitmap to transparent black, and nothing in the wrappers reacted
 * to the change (the update effect / watch covers only the option keys), so
 * the sparkline stayed blank until some *option* happened to change. At a
 * device pixel ratio other than 1 the attribute also had two owners: the
 * wrapper wrote CSS pixels while the core wrote CSS pixels × DPR.
 *
 * The core is now the single owner of the bitmap attributes; the wrappers only
 * size the CSS box and ask the handle to re-render when the box changes.
 */

import { cleanup, render } from "@testing-library/react";
import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { Sparkline as ReactSparkline } from "../../react/sparkline";
import { Sparkline as VueSparkline } from "../../vue/sparkline";

/** Every 2D-context method call, across all canvases — a repaint is a delta. */
let drawCalls = 0;

beforeAll(() => {
  const context2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return () => {
          drawCalls++;
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    context2d;
  // happy-dom does no layout: derive the CSS box from the inline style the
  // wrappers write, the way a browser would. A `.hidden` element has no box.
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    const style = el.style;
    const shown = !el.classList.contains("hidden");
    const w = shown ? Number.parseFloat(style.width || "0") : 0;
    const h = shown ? Number.parseFloat(style.height || "0") : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: w,
      height: h,
      bottom: h,
      right: w,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

beforeEach(() => {
  document.body.innerHTML = "";
  drawCalls = 0;
  window.devicePixelRatio = 1;
});

afterEach(() => {
  cleanup();
});

const data = [1, 3, 2, 5, 4, 6];

describe("React <Sparkline> width/height", () => {
  it("repaints at the new size when only width/height change (same data reference)", () => {
    const { container, rerender } = render(
      <ReactSparkline type="line" data={data} width={80} height={30} />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(30);
    const before = drawCalls;
    expect(before).toBeGreaterThan(0);

    rerender(<ReactSparkline type="line" data={data} width={200} height={60} />);

    expect(canvas.style.width).toBe("200px");
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(60);
    // The stimulus: a repaint actually ran after the size change.
    expect(drawCalls).toBeGreaterThan(before);
  });

  it("keeps the core as the single owner of the bitmap size at DPR 2", () => {
    window.devicePixelRatio = 2;
    const { container, rerender } = render(
      <ReactSparkline type="line" data={data} width={80} height={30} />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(160);

    rerender(<ReactSparkline type="line" data={data} width={200} height={60} />);

    // CSS pixels × DPR, not the CSS-pixel prop the wrapper used to write.
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(120);
  });

  it("does not repaint when neither width nor height changed", () => {
    const { rerender } = render(<ReactSparkline type="line" data={data} width={80} height={30} />);
    const before = drawCalls;
    rerender(<ReactSparkline type="line" data={data} width={80} height={30} />);
    expect(drawCalls).toBe(before);
  });

  it("sizes a hidden canvas from the declared CSS box, before and after a size change", () => {
    window.devicePixelRatio = 2;
    const { container, rerender } = render(
      <ReactSparkline type="line" data={data} width={200} height={60} className="hidden" />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    // No layout box, no width attribute any more — the inline px style is
    // what says the author asked for 200×60, so no 80×30 fallback.
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(120);

    rerender(<ReactSparkline type="line" data={data} width={300} height={90} className="hidden" />);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(180);
  });
});

describe("Vue <Sparkline> width/height", () => {
  it("repaints at the new size when only width/height change (same data reference)", async () => {
    const wrapper = mount(VueSparkline, {
      props: { type: "line", data, width: 80, height: 30 },
      attachTo: document.body,
    });
    const canvas = wrapper.element as HTMLCanvasElement;
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(30);
    const before = drawCalls;
    expect(before).toBeGreaterThan(0);

    await wrapper.setProps({ width: 200, height: 60 });
    await nextTick();

    expect(canvas.style.width).toBe("200px");
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(60);
    expect(drawCalls).toBeGreaterThan(before);
    wrapper.unmount();
  });

  it("keeps the core as the single owner of the bitmap size at DPR 2", async () => {
    window.devicePixelRatio = 2;
    const wrapper = mount(VueSparkline, {
      props: { type: "line", data, width: 80, height: 30 },
      attachTo: document.body,
    });
    const canvas = wrapper.element as HTMLCanvasElement;
    expect(canvas.width).toBe(160);

    await wrapper.setProps({ width: 200, height: 60 });
    await nextTick();

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(120);
    wrapper.unmount();
  });

  it("does not repaint when neither width nor height changed", async () => {
    const wrapper = mount(VueSparkline, {
      props: { type: "line", data, width: 80, height: 30 },
      attachTo: document.body,
    });
    const before = drawCalls;
    await wrapper.setProps({ width: 80, height: 30 });
    await nextTick();
    expect(drawCalls).toBe(before);
    wrapper.unmount();
  });

  it("sizes a hidden canvas from the declared CSS box, before and after a size change", async () => {
    window.devicePixelRatio = 2;
    const wrapper = mount(VueSparkline, {
      props: { type: "line", data, width: 200, height: 60 },
      attrs: { class: "hidden" },
      attachTo: document.body,
    });
    const canvas = wrapper.element as HTMLCanvasElement;
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(120);

    await wrapper.setProps({ width: 300, height: 90 });
    await nextTick();
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(180);
    wrapper.unmount();
  });
});
