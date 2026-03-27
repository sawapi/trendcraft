import { describe, expect, it, vi } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { definePrimitive, defineSeriesRenderer } from "../core/plugin-types";
import { RendererRegistry } from "../core/renderer-registry";

describe("RendererRegistry", () => {
  it("registers and retrieves a custom renderer", () => {
    const registry = new RendererRegistry();
    const renderer = defineSeriesRenderer({
      type: "renko",
      render: vi.fn(),
    });
    registry.registerRenderer(renderer);
    expect(registry.getRenderer("renko")).toBe(renderer);
  });

  it("returns undefined for unknown renderer type", () => {
    const registry = new RendererRegistry();
    expect(registry.getRenderer("unknown")).toBeUndefined();
  });

  it("calls init on renderer registration", () => {
    const registry = new RendererRegistry();
    const init = vi.fn();
    registry.registerRenderer(defineSeriesRenderer({ type: "test", render: vi.fn(), init }));
    expect(init).toHaveBeenCalledOnce();
  });

  it("warns and overwrites on duplicate renderer registration", () => {
    const registry = new RendererRegistry();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r1 = defineSeriesRenderer({ type: "dup", render: vi.fn() });
    const r2 = defineSeriesRenderer({ type: "dup", render: vi.fn() });
    registry.registerRenderer(r1);
    registry.registerRenderer(r2);
    expect(warn).toHaveBeenCalledOnce();
    expect(registry.getRenderer("dup")).toBe(r2);
    warn.mockRestore();
  });

  it("registers and retrieves primitives by pane and zOrder", () => {
    const registry = new RendererRegistry();
    const belowMain = definePrimitive({
      name: "zones",
      pane: "main",
      zOrder: "below",
      defaultState: { x: 1 },
      render: vi.fn(),
    });
    const aboveMain = definePrimitive({
      name: "labels",
      pane: "main",
      zOrder: "above",
      defaultState: null,
      render: vi.fn(),
    });
    const belowSub = definePrimitive({
      name: "subZones",
      pane: "sub_0",
      zOrder: "below",
      defaultState: null,
      render: vi.fn(),
    });

    registry.registerPrimitive(belowMain);
    registry.registerPrimitive(aboveMain);
    registry.registerPrimitive(belowSub);

    expect(registry.getPrimitives("main", "below")).toHaveLength(1);
    expect(registry.getPrimitives("main", "above")).toHaveLength(1);
    expect(registry.getPrimitives("sub_0", "below")).toHaveLength(1);
    expect(registry.getPrimitives("sub_0", "above")).toHaveLength(0);
  });

  it("'all' pane primitives appear on any pane", () => {
    const registry = new RendererRegistry();
    registry.registerPrimitive(
      definePrimitive({
        name: "grid",
        pane: "all",
        zOrder: "below",
        defaultState: null,
        render: vi.fn(),
      }),
    );
    expect(registry.getPrimitives("main", "below")).toHaveLength(1);
    expect(registry.getPrimitives("sub_0", "below")).toHaveLength(1);
    expect(registry.getPrimitives("volume", "below")).toHaveLength(1);
  });

  it("removes a primitive by name", () => {
    const registry = new RendererRegistry();
    const destroy = vi.fn();
    registry.registerPrimitive(
      definePrimitive({
        name: "temp",
        pane: "main",
        zOrder: "above",
        defaultState: null,
        render: vi.fn(),
        destroy,
      }),
    );
    expect(registry.getPrimitives("main", "above")).toHaveLength(1);
    registry.removePrimitive("temp");
    expect(registry.getPrimitives("main", "above")).toHaveLength(0);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("removePrimitive is a no-op for unknown names", () => {
    const registry = new RendererRegistry();
    expect(() => registry.removePrimitive("nonexistent")).not.toThrow();
  });

  it("calls update hook on getPrimitives", () => {
    const registry = new RendererRegistry();
    registry.registerPrimitive(
      definePrimitive({
        name: "counter",
        pane: "main",
        zOrder: "below",
        defaultState: 0,
        render: vi.fn(),
        update: (state: number) => state + 1,
      }),
    );
    const entries1 = registry.getPrimitives("main", "below");
    expect(entries1[0].state).toBe(1);
    const entries2 = registry.getPrimitives("main", "below");
    expect(entries2[0].state).toBe(2);
  });

  it("destroyAll cleans up all renderers and primitives", () => {
    const registry = new RendererRegistry();
    const rendererDestroy = vi.fn();
    const primitiveDestroy = vi.fn();

    registry.registerRenderer(
      defineSeriesRenderer({ type: "a", render: vi.fn(), destroy: rendererDestroy }),
    );
    registry.registerPrimitive(
      definePrimitive({
        name: "b",
        pane: "main",
        zOrder: "below",
        defaultState: null,
        render: vi.fn(),
        destroy: primitiveDestroy,
      }),
    );

    registry.destroyAll();
    expect(rendererDestroy).toHaveBeenCalledOnce();
    expect(primitiveDestroy).toHaveBeenCalledOnce();
    expect(registry.getRenderer("a")).toBeUndefined();
    expect(registry.getPrimitives("main", "below")).toHaveLength(0);
  });

  it("isEmpty returns true when empty, false otherwise", () => {
    const registry = new RendererRegistry();
    expect(registry.isEmpty).toBe(true);
    registry.registerRenderer(defineSeriesRenderer({ type: "x", render: vi.fn() }));
    expect(registry.isEmpty).toBe(false);
  });
});

describe("Custom renderer priceRange", () => {
  it("priceRange is used by custom renderers", () => {
    const registry = new RendererRegistry();
    const priceRange = vi.fn().mockReturnValue([10, 20]);
    registry.registerRenderer(
      defineSeriesRenderer({ type: "custom", render: vi.fn(), priceRange }),
    );

    const series: InternalSeries = {
      id: "s1",
      paneId: "main",
      scaleId: "right",
      type: "custom",
      config: {},
      data: [{ time: 1, value: 15 }],
      visible: true,
    };

    const renderer = registry.getRenderer("custom");
    expect(renderer?.priceRange).toBeDefined();
    const range = renderer!.priceRange!(series, 0, 1);
    expect(range).toEqual([10, 20]);
  });
});

describe("Custom renderer formatValue", () => {
  it("formatValue provides tooltip text", () => {
    const renderer = defineSeriesRenderer({
      type: "custom",
      render: vi.fn(),
      formatValue: (s, idx) => {
        const v = s.data[idx]?.value;
        return v != null ? `Custom: ${v}` : null;
      },
    });

    const series: InternalSeries = {
      id: "s1",
      paneId: "main",
      scaleId: "right",
      type: "custom",
      config: {},
      data: [{ time: 1, value: 42 }],
      visible: true,
    };

    expect(renderer.formatValue!(series, 0)).toBe("Custom: 42");
    expect(renderer.formatValue!(series, 1)).toBeNull();
  });
});

describe("defineSeriesRenderer", () => {
  it("returns the same plugin object (identity function)", () => {
    const plugin = { type: "test" as const, render: vi.fn() };
    expect(defineSeriesRenderer(plugin)).toBe(plugin);
  });
});

describe("definePrimitive", () => {
  it("returns the same plugin object (identity function)", () => {
    const plugin = {
      name: "test",
      pane: "main",
      zOrder: "below" as const,
      defaultState: null,
      render: vi.fn(),
    };
    expect(definePrimitive(plugin)).toBe(plugin);
  });
});
