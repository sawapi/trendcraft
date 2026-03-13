/**
 * useTrading — React hook wrapping TradingSession with periodic state refresh
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState } from "../../agent/types.js";
import { createStateStore } from "../../persistence/store.js";
import { getAllStrategies } from "../../strategy/registry.js";
import type { TradingEvent } from "../../trading/events.js";
import { createTradingSession } from "../../trading/session.js";
import type { SessionOptions, TradingSession } from "../../trading/session.js";

export type TradingState = {
  agents: AgentState[];
  events: TradingEvent[];
  isRunning: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  mode: string;
  startTime: number;
  error: string | null;
};

export type TradingActions = {
  startSession: (opts: SessionOptions) => Promise<void>;
  stopSession: () => Promise<void>;
  session: TradingSession | null;
};

const MAX_EVENTS = 100;

export function useTrading(): [TradingState, TradingActions] {
  const [state, setState] = useState<TradingState>({
    agents: [],
    events: [],
    isRunning: false,
    isInitialized: false,
    isInitializing: false,
    mode: "OFFLINE",
    startTime: 0,
    error: null,
  });

  const sessionRef = useRef<TradingSession | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          const agents = session.getManager().getAllStates();
          setState((prev) => ({ ...prev, agents }));
        }
      }, 5000);

      return () => {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      };
    }
  }, [state.isRunning]);

  const addEvent = useCallback((event: TradingEvent) => {
    setState((prev) => ({
      ...prev,
      events: [...prev.events.slice(-(MAX_EVENTS - 1)), event],
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
  }, []);

  return [
    state,
    {
      startSession,
      stopSession,
      session: sessionRef.current,
    },
  ];
}
