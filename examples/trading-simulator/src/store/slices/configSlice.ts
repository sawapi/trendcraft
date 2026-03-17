import type { EquityPoint, VolumeSpikeSettings } from "../../types";
import { DEFAULT_VOLUME_SPIKE_SETTINGS } from "../../types";
import { calculateCommonDateRange, getSymbolCurrentIndex } from "../helpers";
import type { ConfigSlice, SliceCreator } from "../types";

export const createConfigSlice: SliceCreator<ConfigSlice> = (set, get) => ({
  phase: "setup",
  initialCandleCount: 250,
  initialCapital: 1000000,
  commissionRate: 0,
  slippageBps: 0,
  taxRate: 20.315,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  trailingStopEnabled: false,
  trailingStopPercent: 5,
  volumeSpikeSettings: { ...DEFAULT_VOLUME_SPIKE_SETTINGS },

  setVolumeSpikeSettings: (settings: Partial<VolumeSpikeSettings>) => {
    set((state) => ({
      volumeSpikeSettings: { ...state.volumeSpikeSettings, ...settings },
    }));
  },

  startSimulation: (config) => {
    const { symbols } = get();
    if (symbols.length === 0) return;

    const commonDateRange = calculateCommonDateRange(symbols);
    if (!commonDateRange || commonDateRange.dates.length === 0) return;

    let startDateIdx = commonDateRange.dates.findIndex((d) => d >= config.startDate);
    if (startDateIdx === -1) startDateIdx = 0;

    const initialIdx = Math.max(0, startDateIdx - config.initialCandleCount);
    const simStartDateIdx = Math.max(initialIdx + config.initialCandleCount, startDateIdx);

    const simStartGlobalDate = commonDateRange.dates[simStartDateIdx];

    const updatedSymbols = symbols.map((symbol) => {
      // Use incremental indicators: warm up from candle 0 to current sim position
      const symbolCurrentIdx = getSymbolCurrentIndex(symbol, simStartGlobalDate);
      const warmUpEnd = symbolCurrentIdx >= 0 ? symbolCurrentIdx : 0;

      const indicatorData = get().initIncrementalIndicators(
        symbol.id,
        symbol.allCandles,
        warmUpEnd,
        config.enabledIndicators,
        config.indicatorParams,
      );

      const startDate = commonDateRange.dates[initialIdx];
      const symbolStartIdx = symbol.allCandles.findIndex((c) => c.time === startDate);

      const simStartDate = commonDateRange.dates[simStartDateIdx];
      const simStartCandle = symbol.allCandles.find((c) => c.time === simStartDate);

      const initialEquityPoint: EquityPoint = {
        time: simStartCandle?.time || 0,
        equity: config.initialCapital,
        buyHoldEquity: config.initialCapital,
        drawdown: 0,
      };

      return {
        ...symbol,
        indicatorData,
        startIndex: symbolStartIdx >= 0 ? symbolStartIdx : 0,
        positions: [],
        tradeHistory: [],
        equityCurve: [initialEquityPoint],
      };
    });

    const globalDate = commonDateRange.dates[simStartDateIdx];

    set({
      symbols: updatedSymbols,
      phase: "running",
      initialCandleCount: config.initialCandleCount,
      initialCapital: config.initialCapital,
      enabledIndicators: config.enabledIndicators,
      indicatorParams: config.indicatorParams,
      commissionRate: config.commissionRate,
      slippageBps: config.slippageBps,
      taxRate: config.taxRate,
      stopLossPercent: config.stopLossPercent,
      takeProfitPercent: config.takeProfitPercent,
      trailingStopEnabled: config.trailingStopEnabled,
      trailingStopPercent: config.trailingStopPercent,
      alerts: [],
      isPlaying: false,
      commonDateRange,
      currentDateIndex: simStartDateIdx,
      globalDate,
    });
  },

  finishSimulation: () => {
    set({
      phase: "finished",
      isPlaying: false,
    });
  },

  reset: () => {
    // Clear all incremental registries
    const { symbols } = get();
    for (const symbol of symbols) {
      get().clearIncrementalIndicators(symbol.id);
    }

    set({
      symbols: [],
      activeSymbolId: null,
      phase: "setup",
      commonDateRange: null,
      currentDateIndex: 0,
      globalDate: 0,
      isPlaying: false,
      alerts: [],
    });
  },
});
