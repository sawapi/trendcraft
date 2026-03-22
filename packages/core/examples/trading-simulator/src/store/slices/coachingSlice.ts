import {
  type CoachingLevel,
  type CoachingSignal,
  detectCoachingSignals,
} from "../../engine/signalCoach";
import { getActiveSymbolFromState, getSymbolCurrentIndex } from "../helpers";
import type { SliceCreator } from "../types";

export interface CoachingSlice {
  coachingSignals: CoachingSignal[];
  coachingLevel: CoachingLevel;
  coachingEnabled: boolean;

  setCoachingLevel: (level: CoachingLevel) => void;
  setCoachingEnabled: (enabled: boolean) => void;
  updateCoachingSignals: () => void;
}

export const createCoachingSlice: SliceCreator<CoachingSlice> = (set, get) => ({
  coachingSignals: [],
  coachingLevel: "beginner",
  coachingEnabled: true,

  setCoachingLevel: (level: CoachingLevel) => {
    set({ coachingLevel: level });
  },

  setCoachingEnabled: (enabled: boolean) => {
    set({ coachingEnabled: enabled, coachingSignals: enabled ? get().coachingSignals : [] });
  },

  updateCoachingSignals: () => {
    const { symbols, activeSymbolId, globalDate, coachingEnabled } = get();
    if (!coachingEnabled) {
      set({ coachingSignals: [] });
      return;
    }

    const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!symbol?.indicatorData) {
      set({ coachingSignals: [] });
      return;
    }

    const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
    const signals = detectCoachingSignals(symbol.allCandles, currentIdx, symbol.indicatorData);

    set({ coachingSignals: signals });
  },
});
