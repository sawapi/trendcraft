/**
 * Shared test helpers for chart renderer tests.
 */

import { vi } from "vitest";
import { PriceScale, TimeScale } from "../../core/scale";
import type { CandleData, DataPoint, PaneRect } from "../../core/types";

/** Create a minimal mock CanvasRenderingContext2D.
 *  Uses a Proxy to auto-stub any missing method as a vi.fn(). */
export function mockCtx(): CanvasRenderingContext2D {
  const base: Record<string, unknown> = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    resetTransform: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    font: "",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    globalAlpha: 1,
    canvas: { width: 800, height: 600 },
  };

  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      // Auto-create mock for any uncovered method
      const fn = vi.fn();
      target[prop as string] = fn;
      return fn;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Create a CandleData object */
export function makeCandle(
  time: number,
  close: number,
  high?: number,
  low?: number,
  volume?: number,
): CandleData {
  return {
    time,
    open: close - 1,
    high: high ?? close + 2,
    low: low ?? close - 2,
    close,
    volume: volume ?? 1000,
  };
}

/** Create an InternalSeries-like object */
export function makeSeries(
  data: DataPoint<unknown>[],
  paneId = "main",
): {
  id: string;
  paneId: string;
  scaleId: string;
  type: string;
  config: Record<string, unknown>;
  data: DataPoint<unknown>[];
  visible: boolean;
} {
  return {
    id: "s1",
    paneId,
    scaleId: "right",
    type: "line",
    config: {},
    data,
    visible: true,
  };
}

/** Create a PaneRect */
export function makePane(id: string, height = 300): PaneRect {
  return { id, x: 0, y: 0, width: 800, height, config: { id, flex: 1 } };
}

/** Create a TimeScale configured for testing */
export function makeTimeScale(count = 100, width = 800): TimeScale {
  const ts = new TimeScale();
  ts.setTotalCount(count);
  ts.setWidth(width);
  ts.fitContent();
  return ts;
}

/** Create a PriceScale configured for testing */
export function makePriceScale(height = 400, min = 100, max = 200): PriceScale {
  const ps = new PriceScale();
  ps.setHeight(height);
  ps.setDataRange(min, max);
  return ps;
}
