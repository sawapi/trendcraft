import { useEffect, useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { Position, Trade, IndicatorParams, EquityPoint, SimulatorPhase, SymbolSession } from "../types";

const STORAGE_KEY = "trading-simulator-session";
const SESSION_VERSION = 2; // Version bumped for multi-symbol support

// 複数銘柄対応のセッションデータ
export interface MultiSymbolSessionData {
  version: number;
  savedAt: number;
  activeSymbolId: string | null;
  symbols: Array<{
    id: string;
    fileName: string;
    positions: Position[];
    tradeHistory: Trade[];
    equityCurve: EquityPoint[];
    startIndex: number;
  }>;
  config: {
    initialCandleCount: number;
    initialCapital: number;
    enabledIndicators: string[];
    indicatorParams: IndicatorParams;
    commissionRate: number;
    slippageBps: number;
    taxRate: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    trailingStopEnabled: boolean;
    trailingStopPercent: number;
  };
  phase: SimulatorPhase;
  currentDateIndex: number;
}

// 後方互換性のための旧セッションデータ型
export interface SessionData {
  version: number;
  savedAt: number;
  fileName: string;
  phase: SimulatorPhase;
  currentIndex: number;
  positions: Position[];
  tradeHistory: Trade[];
  equityCurve: EquityPoint[];
  config: {
    startIndex: number;
    initialCandleCount: number;
    initialCapital: number;
    enabledIndicators: string[];
    indicatorParams: IndicatorParams;
    commissionRate: number;
    slippageBps: number;
    taxRate: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    trailingStopEnabled: boolean;
    trailingStopPercent: number;
  };
}

export function saveSession(): void {
  const state = useSimulatorStore.getState();

  // セットアップ中やデータがない場合は保存しない
  if (state.phase === "setup" || state.symbols.length === 0) {
    return;
  }

  const sessionData: MultiSymbolSessionData = {
    version: SESSION_VERSION,
    savedAt: Date.now(),
    activeSymbolId: state.activeSymbolId,
    symbols: state.symbols.map((symbol) => ({
      id: symbol.id,
      fileName: symbol.fileName,
      positions: symbol.positions,
      tradeHistory: symbol.tradeHistory,
      equityCurve: symbol.equityCurve,
      startIndex: symbol.startIndex,
    })),
    config: {
      initialCandleCount: state.initialCandleCount,
      initialCapital: state.initialCapital,
      enabledIndicators: state.enabledIndicators,
      indicatorParams: state.indicatorParams,
      commissionRate: state.commissionRate,
      slippageBps: state.slippageBps,
      taxRate: state.taxRate,
      stopLossPercent: state.stopLossPercent,
      takeProfitPercent: state.takeProfitPercent,
      trailingStopEnabled: state.trailingStopEnabled,
      trailingStopPercent: state.trailingStopPercent,
    },
    phase: state.phase,
    currentDateIndex: state.currentDateIndex,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.warn("Failed to save session:", e);
  }
}

export function loadSession(): SessionData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const session = JSON.parse(data);

    // 旧バージョン（version 1）の場合
    if (session.version === 1) {
      return session as SessionData;
    }

    // 新バージョン（version 2）の場合、旧形式に変換して返す
    // （後方互換性のため、最初のシンボルのみ使用）
    if (session.version === SESSION_VERSION) {
      const multiSession = session as MultiSymbolSessionData;
      if (multiSession.symbols.length === 0) {
        clearSession();
        return null;
      }

      const firstSymbol = multiSession.symbols[0];
      return {
        version: 1, // FileDropZoneの互換性のため
        savedAt: multiSession.savedAt,
        fileName: firstSymbol.fileName,
        phase: multiSession.phase,
        currentIndex: firstSymbol.startIndex + multiSession.config.initialCandleCount + multiSession.currentDateIndex,
        positions: firstSymbol.positions,
        tradeHistory: firstSymbol.tradeHistory,
        equityCurve: firstSymbol.equityCurve,
        config: {
          startIndex: firstSymbol.startIndex,
          initialCandleCount: multiSession.config.initialCandleCount,
          initialCapital: multiSession.config.initialCapital,
          enabledIndicators: multiSession.config.enabledIndicators,
          indicatorParams: multiSession.config.indicatorParams,
          commissionRate: multiSession.config.commissionRate,
          slippageBps: multiSession.config.slippageBps,
          taxRate: multiSession.config.taxRate,
          stopLossPercent: multiSession.config.stopLossPercent,
          takeProfitPercent: multiSession.config.takeProfitPercent,
          trailingStopEnabled: multiSession.config.trailingStopEnabled,
          trailingStopPercent: multiSession.config.trailingStopPercent,
        },
      };
    }

    // 不明なバージョン
    console.warn("Session version mismatch, discarding");
    clearSession();
    return null;
  } catch (e) {
    console.warn("Failed to load session:", e);
    return null;
  }
}

export function loadMultiSymbolSession(): MultiSymbolSessionData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const session = JSON.parse(data);

    if (session.version === SESSION_VERSION) {
      return session as MultiSymbolSessionData;
    }

    return null;
  } catch (e) {
    console.warn("Failed to load multi-symbol session:", e);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear session:", e);
  }
}

export function hasSession(): boolean {
  return loadSession() !== null;
}

export function useSessionPersistence(): void {
  const { phase, symbols } = useSimulatorStore();

  // 取引発生時に自動保存（tradeHistoryの合計長を監視）
  const totalTrades = symbols.reduce((sum, s) => sum + s.tradeHistory.length, 0);

  useEffect(() => {
    if (phase === "running" || phase === "finished") {
      saveSession();
    }
  }, [phase, totalTrades]);

  // 1分ごとに自動保存
  useEffect(() => {
    if (phase !== "running") return;

    const intervalId = setInterval(() => {
      saveSession();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [phase]);

  // ページ離脱時に保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (phase === "running" || phase === "finished") {
        saveSession();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);
}

export function useSessionRestore() {
  const restoreSession = useCallback((session: SessionData, candles: SymbolSession["allCandles"]) => {
    const store = useSimulatorStore.getState();

    store.loadCandles(candles, session.fileName);

    // 状態を直接更新
    useSimulatorStore.setState({
      phase: session.phase,
      initialCandleCount: session.config.initialCandleCount,
      initialCapital: session.config.initialCapital,
      enabledIndicators: session.config.enabledIndicators,
      indicatorParams: session.config.indicatorParams,
      commissionRate: session.config.commissionRate,
      slippageBps: session.config.slippageBps,
      taxRate: session.config.taxRate,
      stopLossPercent: session.config.stopLossPercent,
      takeProfitPercent: session.config.takeProfitPercent,
      trailingStopEnabled: session.config.trailingStopEnabled ?? false,
      trailingStopPercent: session.config.trailingStopPercent ?? 5,
      isPlaying: false,
    });

    // アクティブシンボルの状態を更新
    const activeSymbol = store.symbols.find((s) => s.id === store.activeSymbolId);
    if (activeSymbol) {
      useSimulatorStore.setState({
        symbols: store.symbols.map((s) =>
          s.id === store.activeSymbolId
            ? {
                ...s,
                positions: session.positions,
                tradeHistory: session.tradeHistory,
                equityCurve: session.equityCurve,
                startIndex: session.config.startIndex,
              }
            : s
        ),
      });
    }
  }, []);

  return { restoreSession };
}
