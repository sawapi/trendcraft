import { getSymbolCurrentIndex } from "../helpers";
import type { PlaybackSlice, SliceCreator } from "../types";

export const createPlaybackSlice: SliceCreator<PlaybackSlice> = (set, get) => ({
  isPlaying: false,
  playbackSpeed: 1 as const,
  globalDate: 0,
  currentDateIndex: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),

  stepForward: () => {
    const { currentDateIndex, commonDateRange, symbols } = get();

    if (!commonDateRange) return false;
    if (currentDateIndex >= commonDateRange.dates.length - 1) {
      set({ isPlaying: false });
      return false;
    }

    const newDateIndex = currentDateIndex + 1;
    const newGlobalDate = commonDateRange.dates[newDateIndex];

    set({
      currentDateIndex: newDateIndex,
      globalDate: newGlobalDate,
    });

    // Advance incremental indicators for all symbols
    for (const symbol of symbols) {
      const idx = getSymbolCurrentIndex(symbol, newGlobalDate);
      const candle = symbol.allCandles[idx];
      if (candle) {
        get().advanceIncrementalIndicators(symbol.id, candle);
      }
    }

    // Execute pending orders at new date's open price
    get().executePendingOrders();

    // Update MFE/MAE for all symbols
    get().updatePositionMFEMAE();

    // Update equity curve for all symbols
    get().updateEquityCurve();

    // Check position alerts (stop loss, take profit, trailing stop)
    get().checkPositionAlerts();

    // Check volume spike alerts
    get().checkVolumeSpikeAlerts();

    // Update coaching signals
    get().updateCoachingSignals();

    return true;
  },

  stepBackward: () => {
    const { currentDateIndex, commonDateRange, initialCandleCount } = get();
    if (!commonDateRange) return;

    const minDateIndex = initialCandleCount;
    if (currentDateIndex > minDateIndex) {
      const newDateIndex = currentDateIndex - 1;
      set({
        currentDateIndex: newDateIndex,
        globalDate: commonDateRange.dates[newDateIndex],
      });
    }
  },

  skip: () => {
    get().stepForward();
  },

  jumpToIndex: (index: number) => {
    const { commonDateRange, initialCandleCount } = get();
    if (!commonDateRange) return;

    const minDateIndex = initialCandleCount;
    const maxDateIndex = commonDateRange.dates.length - 1;

    if (index >= minDateIndex && index <= maxDateIndex) {
      set({
        currentDateIndex: index,
        globalDate: commonDateRange.dates[index],
        isPlaying: false,
      });
    }
  },
});
