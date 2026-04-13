import { vi } from "vitest";
import type { ChartEvent, ChartInstance } from "../../core/types";

export type MockChartInstance = ChartInstance & {
  __state: {
    destroyed: boolean;
    eventHandlers: Map<ChartEvent, Set<(data: unknown) => void>>;
    indicators: Set<ReturnType<ChartInstance["addIndicator"]>>;
    drawingIds: Set<string>;
    timeframeIds: Set<string>;
    registeredPrimitives: Set<string>;
    registeredRenderers: number;
    setCandlesCalls: number;
    fitContentCalls: number;
    setThemeCalls: number;
    destroyCalls: number;
  };
};

export function createMockChartInstance(): MockChartInstance {
  const state: MockChartInstance["__state"] = {
    destroyed: false,
    eventHandlers: new Map(),
    indicators: new Set(),
    drawingIds: new Set(),
    timeframeIds: new Set(),
    registeredPrimitives: new Set(),
    registeredRenderers: 0,
    setCandlesCalls: 0,
    fitContentCalls: 0,
    setThemeCalls: 0,
    destroyCalls: 0,
  };

  const chart = {
    __state: state,
    setCandles: vi.fn(() => {
      state.setCandlesCalls++;
    }),
    fitContent: vi.fn(() => {
      state.fitContentCalls++;
    }),
    setTheme: vi.fn(() => {
      state.setThemeCalls++;
    }),
    setChartType: vi.fn(),
    setLayout: vi.fn(),
    addIndicator: vi.fn((_data: unknown, _config?: unknown) => {
      const handle = {
        remove: vi.fn(() => {
          state.indicators.delete(handle as never);
        }),
      };
      state.indicators.add(handle as never);
      return handle as never;
    }),
    addSignals: vi.fn(),
    addTrades: vi.fn(),
    addDrawing: vi.fn((d: { id: string }) => {
      state.drawingIds.add(d.id);
    }),
    removeDrawing: vi.fn((id: string) => {
      state.drawingIds.delete(id);
    }),
    addTimeframe: vi.fn((t: { id: string }) => {
      state.timeframeIds.add(t.id);
    }),
    removeTimeframe: vi.fn((id: string) => {
      state.timeframeIds.delete(id);
    }),
    addBacktest: vi.fn(),
    addPatterns: vi.fn(),
    addScores: vi.fn(),
    registerRenderer: vi.fn(() => {
      state.registeredRenderers++;
    }),
    registerPrimitive: vi.fn((p: { name: string }) => {
      state.registeredPrimitives.add(p.name);
    }),
    removePrimitive: vi.fn((name: string) => {
      state.registeredPrimitives.delete(name);
    }),
    on: vi.fn((event: ChartEvent, handler: (data: unknown) => void) => {
      let set = state.eventHandlers.get(event);
      if (!set) {
        set = new Set();
        state.eventHandlers.set(event, set);
      }
      set.add(handler);
    }),
    off: vi.fn((event: ChartEvent, handler: (data: unknown) => void) => {
      state.eventHandlers.get(event)?.delete(handler);
    }),
    destroy: vi.fn(() => {
      state.destroyCalls++;
      state.destroyed = true;
      state.eventHandlers.clear();
    }),
  } as unknown as MockChartInstance;

  return chart;
}
