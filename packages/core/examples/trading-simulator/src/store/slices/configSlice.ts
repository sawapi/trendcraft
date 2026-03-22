import type { EquityPoint, VolumeSpikeSettings } from "../../types";
import { DEFAULT_INDICATOR_PARAMS, DEFAULT_VOLUME_SPIKE_SETTINGS } from "../../types";
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

  quickStart: () => {
    const { symbols } = get();
    if (symbols.length === 0) return;

    const allDates = symbols[0].allCandles.map((c) => c.time);
    const defaultStartIdx = Math.max(0, allDates.length - 250);
    const startDate = allDates[defaultStartIdx];

    get().startSimulation({
      startDate,
      initialCandleCount: 250,
      initialCapital: 1_000_000,
      enabledIndicators: ["sma25", "sma75", "volume"],
      indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      commissionRate: 0,
      slippageBps: 0,
      taxRate: 20.315,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      trailingStopEnabled: false,
      trailingStopPercent: 5,
    });
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

  resetFunds: () => {
    const {
      symbols,
      commonDateRange,
      initialCandleCount,
      initialCapital,
      enabledIndicators,
      indicatorParams,
    } = get();
    if (symbols.length === 0 || !commonDateRange) return;

    // Re-initialize from the simulation start point
    const simStartDateIdx = initialCandleCount;
    const simStartGlobalDate = commonDateRange.dates[simStartDateIdx];

    const updatedSymbols = symbols.map((symbol) => {
      // Re-initialize incremental indicators
      const symbolCurrentIdx = getSymbolCurrentIndex(symbol, simStartGlobalDate);
      const warmUpEnd = symbolCurrentIdx >= 0 ? symbolCurrentIdx : 0;

      const indicatorData = get().initIncrementalIndicators(
        symbol.id,
        symbol.allCandles,
        warmUpEnd,
        enabledIndicators,
        indicatorParams,
      );

      const simStartCandle = symbol.allCandles.find((c) => c.time === simStartGlobalDate);

      const initialEquityPoint: EquityPoint = {
        time: simStartCandle?.time || 0,
        equity: initialCapital,
        buyHoldEquity: initialCapital,
        drawdown: 0,
      };

      return {
        ...symbol,
        indicatorData,
        positions: [],
        tradeHistory: [],
        equityCurve: [initialEquityPoint],
      };
    });

    set({
      symbols: updatedSymbols,
      currentDateIndex: simStartDateIdx,
      globalDate: simStartGlobalDate,
      isPlaying: false,
      alerts: [],
      pendingOrders: [],
      _undoStack: [],
      _redoStack: [],
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
