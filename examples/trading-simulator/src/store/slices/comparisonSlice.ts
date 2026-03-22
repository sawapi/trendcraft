import type { SavedSession, Trade } from "../../types";
import { generateId, getActiveSymbolFromState } from "../helpers";
import type { ComparisonSlice, SliceCreator } from "../types";

export const createComparisonSlice: SliceCreator<ComparisonSlice> = (set, get) => ({
  savedSessions: [],

  saveCurrentSession: (name: string) => {
    const { symbols, activeSymbolId, initialCapital } = get();
    const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!symbol || symbol.equityCurve.length <= 1) return;

    const closeTrades = symbol.tradeHistory.filter(
      (t: Trade) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && t.pnlPercent !== undefined,
    );

    const totalPnl = closeTrades.reduce((sum: number, t: Trade) => sum + (t.pnl || 0), 0);
    const wins = closeTrades.filter((t: Trade) => (t.pnl || 0) > 0).length;

    let peak = initialCapital;
    let maxDrawdown = 0;
    let equity = initialCapital;
    for (const t of closeTrades) {
      equity += t.pnl || 0;
      if (equity > peak) peak = equity;
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const session: SavedSession = {
      id: generateId(),
      name,
      savedAt: Date.now(),
      equityCurve: [...symbol.equityCurve],
      stats: {
        totalPnl,
        totalPnlPercent: (totalPnl / initialCapital) * 100,
        winRate: closeTrades.length > 0 ? (wins / closeTrades.length) * 100 : 0,
        maxDrawdown,
        tradeCount: closeTrades.length,
      },
    };

    set((state) => ({
      savedSessions: [...state.savedSessions, session],
    }));
  },

  removeSavedSession: (id: string) => {
    set((state) => ({
      savedSessions: state.savedSessions.filter((s) => s.id !== id),
    }));
  },

  clearSavedSessions: () => {
    set({ savedSessions: [] });
  },
});
