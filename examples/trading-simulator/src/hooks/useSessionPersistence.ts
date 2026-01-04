import { useEffect, useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { Position, Trade, IndicatorParams, EquityPoint, SimulatorPhase, NormalizedCandle } from "../types";

const STORAGE_KEY = "trading-simulator-session";
const SESSION_VERSION = 1;

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
  if (state.phase === "setup" || state.allCandles.length === 0) {
    return;
  }

  const sessionData: SessionData = {
    version: SESSION_VERSION,
    savedAt: Date.now(),
    fileName: state.fileName,
    phase: state.phase,
    currentIndex: state.currentIndex,
    positions: state.positions,
    tradeHistory: state.tradeHistory,
    equityCurve: state.equityCurve,
    config: {
      startIndex: state.startIndex,
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

    const session = JSON.parse(data) as SessionData;

    // バージョンチェック
    if (session.version !== SESSION_VERSION) {
      console.warn("Session version mismatch, discarding");
      clearSession();
      return null;
    }

    return session;
  } catch (e) {
    console.warn("Failed to load session:", e);
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
  const { phase, tradeHistory } = useSimulatorStore();

  // 取引発生時に自動保存
  useEffect(() => {
    if (phase === "running" || phase === "finished") {
      saveSession();
    }
  }, [phase, tradeHistory.length]);

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
  const restoreSession = useCallback((session: SessionData, candles: NormalizedCandle[]) => {
    const store = useSimulatorStore.getState();

    // indicatorDataを再計算
    // 注: calculateIndicatorsをimportする必要があるが、循環参照を避けるため
    // storeのstartSimulation相当の処理をここで行う

    store.loadCandles(candles, session.fileName);

    // 状態を直接更新
    useSimulatorStore.setState({
      phase: session.phase,
      startIndex: session.config.startIndex,
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
      currentIndex: session.currentIndex,
      positions: session.positions,
      tradeHistory: session.tradeHistory,
      equityCurve: session.equityCurve,
      isPlaying: false,
    });
  }, []);

  return { restoreSession };
}
