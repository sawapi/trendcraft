import type { NormalizedCandle, SymbolSession } from "../../types";
import { calculateCommonDateRange, generateId, getActiveSymbolFromState } from "../helpers";
import type { SliceCreator, SymbolSlice } from "../types";

export const createSymbolSlice: SliceCreator<SymbolSlice> = (set, get) => ({
  symbols: [],
  activeSymbolId: null,
  commonDateRange: null,

  createSymbolSession: (candles: NormalizedCandle[], fileName: string) => {
    const id = generateId();
    const newSession: SymbolSession = {
      id,
      fileName,
      allCandles: candles,
      positions: [],
      tradeHistory: [],
      indicatorData: null,
      equityCurve: [],
      startIndex: 0,
    };

    set((state) => {
      const newSymbols = [...state.symbols, newSession];
      return {
        symbols: newSymbols,
        activeSymbolId: state.activeSymbolId || id,
      };
    });

    return id;
  },

  closeSymbolSession: (symbolId: string) => {
    set((state) => {
      const newSymbols = state.symbols.filter((s) => s.id !== symbolId);
      let newActiveId = state.activeSymbolId;

      if (state.activeSymbolId === symbolId) {
        newActiveId = newSymbols[0]?.id || null;
      }

      const newCommonDateRange = calculateCommonDateRange(newSymbols);

      return {
        symbols: newSymbols,
        activeSymbolId: newActiveId,
        commonDateRange: newCommonDateRange,
        phase: newSymbols.length === 0 ? "setup" : state.phase,
      };
    });
  },

  switchSymbol: (symbolId: string) => {
    set({ activeSymbolId: symbolId });
  },

  nextSymbol: () => {
    const { symbols, activeSymbolId } = get();
    if (symbols.length <= 1) return;

    const currentIdx = symbols.findIndex((s) => s.id === activeSymbolId);
    const nextIdx = (currentIdx + 1) % symbols.length;
    set({ activeSymbolId: symbols[nextIdx].id });
  },

  previousSymbol: () => {
    const { symbols, activeSymbolId } = get();
    if (symbols.length <= 1) return;

    const currentIdx = symbols.findIndex((s) => s.id === activeSymbolId);
    const prevIdx = currentIdx <= 0 ? symbols.length - 1 : currentIdx - 1;
    set({ activeSymbolId: symbols[prevIdx].id });
  },

  getActiveSymbol: () => {
    const { symbols, activeSymbolId } = get();
    return getActiveSymbolFromState(symbols, activeSymbolId);
  },

  getAllSymbols: () => get().symbols,

  loadCandles: (candles: NormalizedCandle[], fileName: string) => {
    const id = generateId();
    const newSession: SymbolSession = {
      id,
      fileName,
      allCandles: candles,
      positions: [],
      tradeHistory: [],
      indicatorData: null,
      equityCurve: [],
      startIndex: 0,
    };

    set({
      symbols: [newSession],
      activeSymbolId: id,
      phase: "setup",
      commonDateRange: null,
      currentDateIndex: 0,
      globalDate: 0,
    });
  },
});
