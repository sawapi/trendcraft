import { afterEach, describe, expect, it, vi } from "vitest";

describe("SSR safety", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    // Restore document after each test
    if (originalDocument) {
      globalThis.document = originalDocument;
    }
  });

  it("createChart throws descriptive error when document is undefined", async () => {
    // Temporarily remove document
    const saved = globalThis.document;
    // @ts-expect-error — intentionally setting to undefined for SSR test
    globalThis.document = undefined;

    try {
      // Dynamic import to evaluate in the no-document context
      const { createChart } = await import("../index");
      expect(() => createChart(null as unknown as HTMLElement)).toThrow(
        "@trendcraft/chart: createChart() requires a browser environment",
      );
      expect(() => createChart(null as unknown as HTMLElement)).toThrow("headless");
    } finally {
      globalThis.document = saved;
    }
  });

  it("CanvasChart constructor throws when document is undefined", async () => {
    const saved = globalThis.document;
    // @ts-expect-error — intentionally setting to undefined for SSR test
    globalThis.document = undefined;

    try {
      const { CanvasChart } = await import("../renderer/canvas-chart");
      expect(() => new CanvasChart(null as unknown as HTMLElement)).toThrow("browser environment");
    } finally {
      globalThis.document = saved;
    }
  });

  it("headless exports do not require document", async () => {
    // Headless should work without DOM
    const headless = await import("../headless");
    expect(headless.DataLayer).toBeDefined();
    expect(headless.TimeScale).toBeDefined();
    expect(headless.PriceScale).toBeDefined();
  });

  it("react wrapper can be imported in node environment without crashing", async () => {
    // Import should not throw — component is a function, not auto-rendering
    const mod = await import("../../react/TrendChart");
    expect(mod.TrendChart).toBeDefined();
    expect(typeof mod.TrendChart).toBe("object"); // forwardRef wraps as object
  });

  it("vue wrapper can be imported in node environment without crashing", async () => {
    const mod = await import("../../vue/TrendChart");
    expect(mod.TrendChart).toBeDefined();
    expect(typeof mod.TrendChart).toBe("object"); // defineComponent returns object
  });
});
