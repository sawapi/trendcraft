/**
 * History Slice — Undo/Redo for trade operations
 *
 * Snapshots trading state (positions, tradeHistory, equityCurve) before each trade.
 * Ctrl+Z undoes the last trade, Ctrl+Shift+Z redoes.
 * Max 50 snapshots.
 */

import type { EquityPoint, Position, Trade } from "../../types";
import type { SliceCreator } from "../types";

const MAX_HISTORY = 50;

export interface TradeSnapshot {
  symbolId: string;
  positions: Position[];
  tradeHistory: Trade[];
  equityCurve: EquityPoint[];
}

export interface HistorySlice {
  _undoStack: TradeSnapshot[];
  _redoStack: TradeSnapshot[];

  /** Save current trade state before a trade operation */
  pushTradeSnapshot: () => void;

  /** Undo the last trade */
  undoTrade: () => void;

  /** Redo the last undone trade */
  redoTrade: () => void;

  /** Check if undo/redo is available */
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const createHistorySlice: SliceCreator<HistorySlice> = (set, get) => ({
  _undoStack: [],
  _redoStack: [],

  pushTradeSnapshot: () => {
    const { symbols, activeSymbolId } = get();
    const symbol = symbols.find((s) => s.id === activeSymbolId);
    if (!symbol) return;

    const snapshot: TradeSnapshot = {
      symbolId: symbol.id,
      positions: [...symbol.positions],
      tradeHistory: [...symbol.tradeHistory],
      equityCurve: [...symbol.equityCurve],
    };

    set((state) => ({
      _undoStack: [...state._undoStack.slice(-(MAX_HISTORY - 1)), snapshot],
      _redoStack: [], // Clear redo on new action
    }));
  },

  undoTrade: () => {
    const { _undoStack, symbols } = get();
    if (_undoStack.length === 0) return;

    const snapshot = _undoStack[_undoStack.length - 1];
    const symbol = symbols.find((s) => s.id === snapshot.symbolId);
    if (!symbol) return;

    // Save current state to redo stack
    const currentSnapshot: TradeSnapshot = {
      symbolId: symbol.id,
      positions: [...symbol.positions],
      tradeHistory: [...symbol.tradeHistory],
      equityCurve: [...symbol.equityCurve],
    };

    // Restore from undo snapshot
    const updatedSymbols = symbols.map((s) =>
      s.id === snapshot.symbolId
        ? {
            ...s,
            positions: snapshot.positions,
            tradeHistory: snapshot.tradeHistory,
            equityCurve: snapshot.equityCurve,
          }
        : s,
    );

    set({
      symbols: updatedSymbols,
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [...get()._redoStack, currentSnapshot],
    });
  },

  redoTrade: () => {
    const { _redoStack, symbols } = get();
    if (_redoStack.length === 0) return;

    const snapshot = _redoStack[_redoStack.length - 1];
    const symbol = symbols.find((s) => s.id === snapshot.symbolId);
    if (!symbol) return;

    // Save current state to undo stack
    const currentSnapshot: TradeSnapshot = {
      symbolId: symbol.id,
      positions: [...symbol.positions],
      tradeHistory: [...symbol.tradeHistory],
      equityCurve: [...symbol.equityCurve],
    };

    const updatedSymbols = symbols.map((s) =>
      s.id === snapshot.symbolId
        ? {
            ...s,
            positions: snapshot.positions,
            tradeHistory: snapshot.tradeHistory,
            equityCurve: snapshot.equityCurve,
          }
        : s,
    );

    set({
      symbols: updatedSymbols,
      _undoStack: [...get()._undoStack, currentSnapshot],
      _redoStack: _redoStack.slice(0, -1),
    });
  },

  canUndo: () => get()._undoStack.length > 0,
  canRedo: () => get()._redoStack.length > 0,
});
