/**
 * AgentManager — orchestrates all agents
 *
 * Routes WebSocket trade data to the appropriate agents,
 * manages the agent lifecycle, and evaluates leaderboard rankings.
 */

import type { NormalizedCandle, streaming } from "trendcraft";
import type { OrderIntent } from "../executor/types.js";
import type { StrategyDefinition } from "../strategy/types.js";
import type { Agent } from "./agent.js";
import { createAgent } from "./agent.js";
import type { AgentState } from "./types.js";

export type AgentManagerOptions = {
  capital?: number;
};

export type AgentManager = {
  addAgent(strategy: StrategyDefinition, symbol: string, warmUp?: NormalizedCandle[]): Agent;
  removeAgent(agentId: string): void;
  onTrade(symbol: string, trade: streaming.Trade): OrderIntent[];
  closeAll(): OrderIntent[];
  getAgents(): Agent[];
  getAgent(agentId: string): Agent | undefined;
  getSymbols(): string[];
  getAllStates(): AgentState[];
  restoreStates(states: AgentState[], strategies: Map<string, StrategyDefinition>): void;
};

export function createAgentManager(opts?: AgentManagerOptions): AgentManager {
  const agents = new Map<string, Agent>();
  const symbolAgents = new Map<string, Set<string>>();

  function addToSymbolMap(symbol: string, agentId: string): void {
    let set = symbolAgents.get(symbol);
    if (!set) {
      set = new Set();
      symbolAgents.set(symbol, set);
    }
    set.add(agentId);
  }

  function removeFromSymbolMap(symbol: string, agentId: string): void {
    const set = symbolAgents.get(symbol);
    if (set) {
      set.delete(agentId);
      if (set.size === 0) symbolAgents.delete(symbol);
    }
  }

  return {
    addAgent(strategy, symbol, warmUp) {
      const agent = createAgent(strategy, symbol, {
        capital: opts?.capital,
        warmUp,
      });
      agents.set(agent.id, agent);
      addToSymbolMap(symbol, agent.id);
      return agent;
    },

    removeAgent(agentId: string) {
      const agent = agents.get(agentId);
      if (agent) {
        removeFromSymbolMap(agent.symbol, agentId);
        agents.delete(agentId);
      }
    },

    onTrade(symbol: string, trade: streaming.Trade): OrderIntent[] {
      const agentIds = symbolAgents.get(symbol);
      if (!agentIds) return [];

      const allIntents: OrderIntent[] = [];
      for (const agentId of agentIds) {
        const agent = agents.get(agentId);
        if (agent) {
          const { intents } = agent.feedTrade(trade);
          allIntents.push(...intents);
        }
      }
      return allIntents;
    },

    closeAll(): OrderIntent[] {
      const allIntents: OrderIntent[] = [];
      for (const agent of agents.values()) {
        const { intents } = agent.close();
        allIntents.push(...intents);
      }
      return allIntents;
    },

    getAgents() {
      return [...agents.values()];
    },

    getAgent(agentId: string) {
      return agents.get(agentId);
    },

    getSymbols() {
      return [...symbolAgents.keys()];
    },

    getAllStates(): AgentState[] {
      return [...agents.values()].map((a) => a.getState());
    },

    restoreStates(states, strategies) {
      for (const state of states) {
        const strategy = strategies.get(state.strategyId);
        if (!strategy) {
          console.warn(`Strategy "${state.strategyId}" not found, skipping agent ${state.id}`);
          continue;
        }
        const agent = createAgent(strategy, state.symbol, {
          capital: opts?.capital,
          tier: state.tier,
          fromState: state,
        });
        agents.set(agent.id, agent);
        addToSymbolMap(state.symbol, agent.id);
      }
    },
  };
}
