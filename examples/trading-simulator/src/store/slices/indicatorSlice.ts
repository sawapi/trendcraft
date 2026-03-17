import type { IndicatorParams } from "../../types";
import { DEFAULT_INDICATOR_PARAMS } from "../../types";
import { getActiveSymbolFromState, getSymbolCurrentIndex } from "../helpers";
import type { IndicatorSlice, SliceCreator } from "../types";

export const createIndicatorSlice: SliceCreator<IndicatorSlice> = (set, get) => ({
  enabledIndicators: [],
  indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },

  setEnabledIndicators: (indicators: string[]) => {
    const { symbols, activeSymbolId, globalDate } = get();
    const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!symbol) return;

    // Re-initialize incremental indicators with new set
    const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
    const warmUpEnd = currentIdx >= 0 ? currentIdx : 0;

    const indicatorData = get().initIncrementalIndicators(
      symbol.id,
      symbol.allCandles,
      warmUpEnd,
      indicators,
      get().indicatorParams,
    );

    set((state) => ({
      enabledIndicators: indicators,
      symbols: state.symbols.map((s) => (s.id === symbol.id ? { ...s, indicatorData } : s)),
    }));
  },

  setIndicatorParams: (params: IndicatorParams) => {
    const { symbols, activeSymbolId, globalDate, enabledIndicators } = get();
    const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!symbol) return;

    // Re-initialize incremental indicators with new params
    const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
    const warmUpEnd = currentIdx >= 0 ? currentIdx : 0;

    const indicatorData = get().initIncrementalIndicators(
      symbol.id,
      symbol.allCandles,
      warmUpEnd,
      enabledIndicators,
      params,
    );

    set((state) => ({
      indicatorParams: params,
      symbols: state.symbols.map((s) => (s.id === symbol.id ? { ...s, indicatorData } : s)),
    }));
  },
});
