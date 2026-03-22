import { create } from "zustand";
import { getActiveCurrentIndex, getActiveSymbolFromState } from "./helpers";
import { createAlertSlice } from "./slices/alertSlice";
import { createCoachingSlice } from "./slices/coachingSlice";
import { createComparisonSlice } from "./slices/comparisonSlice";
import { createComputedSlice } from "./slices/computedSlice";
import { createConfigSlice } from "./slices/configSlice";
import { createDrawingSlice } from "./slices/drawingSlice";
import { createHistorySlice } from "./slices/historySlice";
import { createIncrementalIndicatorSlice } from "./slices/incrementalIndicatorSlice";
import { createIndicatorSlice } from "./slices/indicatorSlice";
import { createOrderSlice } from "./slices/orderSlice";
import { createPlaybackSlice } from "./slices/playbackSlice";
import { createSymbolSlice } from "./slices/symbolSlice";
import { createTradingSlice } from "./slices/tradingSlice";
import type { SimulatorState } from "./types";

export const useSimulatorStore = create<SimulatorState>((...a) => {
  const [, get] = a;

  const store = {
    ...createSymbolSlice(...a),
    ...createPlaybackSlice(...a),
    ...createTradingSlice(...a),
    ...createOrderSlice(...a),
    ...createAlertSlice(...a),
    ...createIndicatorSlice(...a),
    ...createConfigSlice(...a),
    ...createComputedSlice(...a),
    ...createIncrementalIndicatorSlice(...a),
    ...createCoachingSlice(...a),
    ...createHistorySlice(...a),
    ...createDrawingSlice(...a),
    ...createComparisonSlice(...a),
  };

  // Backward compatibility getters — must use Object.defineProperties
  // because spread (...) eagerly evaluates ES5 getters, but get() is not
  // available until after the store is fully constructed.
  const getActiveSymbol = () => {
    const { symbols, activeSymbolId } = get();
    return getActiveSymbolFromState(symbols, activeSymbolId);
  };

  Object.defineProperties(store, {
    fileName: {
      get: () => getActiveSymbol()?.fileName || "",
      enumerable: true,
    },
    allCandles: {
      get: () => getActiveSymbol()?.allCandles || [],
      enumerable: true,
    },
    positions: {
      get: () => getActiveSymbol()?.positions || [],
      enumerable: true,
    },
    tradeHistory: {
      get: () => getActiveSymbol()?.tradeHistory || [],
      enumerable: true,
    },
    indicatorData: {
      get: () => getActiveSymbol()?.indicatorData || null,
      enumerable: true,
    },
    equityCurve: {
      get: () => getActiveSymbol()?.equityCurve || [],
      enumerable: true,
    },
    currentIndex: {
      get: () => {
        const { symbols, activeSymbolId, commonDateRange, currentDateIndex } = get();
        return getActiveCurrentIndex(symbols, activeSymbolId, commonDateRange, currentDateIndex);
      },
      enumerable: true,
    },
    startIndex: {
      get: () => getActiveSymbol()?.startIndex || 0,
      enumerable: true,
    },
  });

  return store;
});
