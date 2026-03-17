/**
 * useTrading — React hook wrapping TradingSession with periodic state refresh
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BenchmarkSnapshot } from "../../agent/market-state.js";
import type { AgentState } from "../../agent/types.js";
import { createStateStore } from "../../persistence/store.js";
import type { TradingEvent } from "../../trading/events.js";
import { createTradingSession } from "../../trading/session.js";
import type { SessionOptions, TradingSession } from "../../trading/session.js";

export type TimestampedEvent = {
  event: TradingEvent;
  timestamp: number;
};

export type PortfolioExposureSnapshot = {
  totalPercent: number;
  openPositions: number;
};

export type TradingState = {
  agents: AgentState[];
  events: TimestampedEvent[];
  tickerSnapshots: BenchmarkSnapshot[];
  isRunning: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  mode: string;
  startTime: number;
  error: string | null;
  deactivatedStrategies: Set<string>;
  portfolioExposure: PortfolioExposureSnapshot | null;
  unrealizedPnl: number;
};

type KilledAgent = {
  strategyId: string;
  symbol: string;
};

export type TradingActions = {
  startSession: (opts: SessionOptions) => Promise<void>;
  stopSession: () => Promise<void>;
  killAgent: (agentId: string) => void;
  reviveAgent: (agentId: string) => void;
  getKilledAgents: () => Map<string, KilledAgent>;
  session: TradingSession | null;
};

const MAX_EVENTS = 100;

export function useTrading(): [TradingState, TradingActions] {
  const [state, setState] = useState<TradingState>({
    agents: [],
    events: [],
    tickerSnapshots: [],
    isRunning: false,
    isInitialized: false,
    isInitializing: false,
    mode: "OFFLINE",
    startTime: 0,
    error: null,
    deactivatedStrategies: new Set<string>(),
    portfolioExposure: null,
    unrealizedPnl: 0,
  });

  const sessionRef = useRef<TradingSession | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const killedAgentsRef = useRef<Map<string, KilledAgent>>(new Map());

  // Load offline state from state.json on mount
  useEffect(() => {
    const store = createStateStore();
    const saved = store.load();
    if (saved && saved.agents.length > 0) {
      setState((prev) => ({
        ...prev,
        agents: saved.agents,
      }));
    }
  }, []);

  // Periodic refresh of agent states when running
  useEffect(() => {
    if (state.isRunning && sessionRef.current) {
      refreshTimerRef.current = setInterval(() => {
        const session = sessionRef.current;
        if (session?.isRunning()) {
          const mgr = session.getManager();
          const agents = mgr.getAllStates();
          const deactivatedStrategies = mgr.getDeactivatedStrategies();
          const tickerSnapshots = session.getMarketState().getAllSnapshots();

          // Portfolio exposure
          const rawExposure = mgr.getPortfolioExposure();
          const portfolioExposure: PortfolioExposureSnapshot | null = rawExposure
            ? { totalPercent: rawExposure.totalPercent, openPositions: rawExposure.openPositions }
            : null;

          // Unrealized P&L: sum across agents with open positions
          const snapshotMap = new Map(tickerSnapshots.map((s) => [s.symbol, s]));
          let unrealizedPnl = 0;
          for (const a of agents) {
            const pos = a.sessionState?.trackerState?.position;
            if (pos && pos.shares > 0) {
              const snap = snapshotMap.get(a.symbol);
              if (snap) {
                unrealizedPnl += (snap.lastPrice - pos.entryPrice) * pos.shares;
              }
            }
          }

          setState((prev) => ({
            ...prev,
            agents,
            deactivatedStrategies,
            tickerSnapshots,
            portfolioExposure,
            unrealizedPnl,
          }));
        }
      }, 5000);

      return () => {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      };
    }
  }, [state.isRunning]);

  const addEvent = useCallback((event: TradingEvent) => {
    const stamped: TimestampedEvent = { event, timestamp: Date.now() };
    setState((prev) => ({
      ...prev,
      events: [...prev.events.slice(-(MAX_EVENTS - 1)), stamped],
    }));
  }, []);

  const startSession = useCallback(
    async (opts: SessionOptions) => {
      if (sessionRef.current?.isRunning()) return;

      setState((prev) => ({ ...prev, isInitializing: true, error: null }));

      try {
        const session = createTradingSession(opts);
        sessionRef.current = session;

        session.onEvent(addEvent);

        await session.init();
        const agents = session.getManager().getAllStates();

        setState((prev) => ({
          ...prev,
          agents,
          isInitialized: true,
          isInitializing: false,
          mode: session.getMode(),
        }));

        await session.start();

        setState((prev) => ({
          ...prev,
          isRunning: true,
          startTime: session.getStartTime(),
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isInitializing: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [addEvent],
  );

  const stopSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.isRunning()) return;

    await session.stop();
    const agents = session.getManager().getAllStates();

    setState((prev) => ({
      ...prev,
      agents,
      isRunning: false,
      mode: "OFFLINE",
    }));

    sessionRef.current = null;
    killedAgentsRef.current.clear();
  }, []);

  const killAgent = useCallback((agentId: string) => {
    const session = sessionRef.current;
    if (!session?.isRunning()) return;

    const manager = session.getManager();
    const agent = manager.getAgent(agentId);
    if (!agent) return;

    // Close the agent's position first
    const { intents } = agent.close();
    const executor = session.getExecutor();
    for (const intent of intents) {
      executor.execute(intent);
    }

    // Record before removal
    killedAgentsRef.current.set(agentId, {
      strategyId: agent.strategyId,
      symbol: agent.symbol,
    });

    manager.removeAgent(agentId);

    // Refresh state
    const agents = manager.getAllStates();
    setState((prev) => ({ ...prev, agents }));
  }, []);

  const reviveAgent = useCallback((agentId: string) => {
    const session = sessionRef.current;
    if (!session?.isRunning()) return;

    const killed = killedAgentsRef.current.get(agentId);
    if (!killed) return;

    const strategies = session.getStrategies();
    const strategy = strategies.find((s) => s.id === killed.strategyId);
    if (!strategy) return;

    const manager = session.getManager();
    manager.addAgent(strategy, killed.symbol);
    killedAgentsRef.current.delete(agentId);

    // Refresh state
    const agents = manager.getAllStates();
    setState((prev) => ({ ...prev, agents }));
  }, []);

  const getKilledAgents = useCallback(() => {
    return new Map(killedAgentsRef.current);
  }, []);

  return [
    state,
    {
      startSession,
      stopSession,
      killAgent,
      reviveAgent,
      getKilledAgents,
      session: sessionRef.current,
    },
  ];
}
