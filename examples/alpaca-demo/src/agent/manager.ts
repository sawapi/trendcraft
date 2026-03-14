/**
 * AgentManager — orchestrates all agents
 *
 * Routes WebSocket trade data to the appropriate agents,
 * manages the agent lifecycle, evaluates leaderboard rankings,
 * and enforces portfolio-level risk limits via PortfolioGuard.
 */

import { type NormalizedCandle, type StrategyDefinition, streaming } from "trendcraft";
import type { OrderIntent } from "../executor/types.js";
import { checkSectorExposure } from "../risk/correlation-guard.js";
import type { EarningsGuard } from "../risk/earnings-guard.js";
import type { SectorId } from "../sec/types.js";
import type { MarketFilter } from "../strategy/template.js";
import type { Agent } from "./agent.js";
import { createAgent } from "./agent.js";
import type { MarketState } from "./market-state.js";
import type { AgentState, ManagerState } from "./types.js";

export type AgentManagerOptions = {
  capital?: number;
  portfolioGuard?: streaming.PortfolioGuardOptions;
  marketState?: MarketState;
  /** Symbol → sector map for correlation guard */
  sectorMap?: Map<string, SectorId>;
  /** Maximum positions per sector (default: 2) */
  maxSectorPositions?: number;
  /** Earnings guard — blocks entries near earnings dates */
  earningsGuard?: EarningsGuard;
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
  getState(): ManagerState;
  restoreStates(
    states: AgentState[],
    strategies: Map<string, StrategyDefinition>,
    portfolioGuardState?: streaming.PortfolioGuardState,
  ): void;
  getPortfolioExposure(): streaming.PortfolioExposure | null;
  /** Hot-swap strategy for an agent (used by intra-session review) */
  replaceAgentStrategy(agentId: string, newStrategy: StrategyDefinition): boolean;
  /** Set market filter for a strategy (used by LLM overrides) */
  setMarketFilter(strategyId: string, filter: MarketFilter | null): void;
  /** Deactivate all agents for a strategy (regime rotation) */
  deactivateStrategy(strategyId: string): void;
  /** Reactivate all agents for a strategy (regime rotation) */
  activateStrategy(strategyId: string): void;
  /** Get set of deactivated strategy IDs */
  getDeactivatedStrategies(): Set<string>;
};

export function createAgentManager(opts?: AgentManagerOptions): AgentManager {
  const agents = new Map<string, Agent>();
  const symbolAgents = new Map<string, Set<string>>();
  const marketFilters = new Map<string, MarketFilter>();
  const marketState = opts?.marketState ?? null;
  const sectorMap = opts?.sectorMap ?? new Map<string, SectorId>();
  const maxSectorPositions = opts?.maxSectorPositions ?? 2;
  const earningsGuard = opts?.earningsGuard ?? null;
  const deactivatedStrategies = new Set<string>();

  let portfolioGuard: streaming.PortfolioGuard | null = null;
  if (opts?.portfolioGuard) {
    portfolioGuard = streaming.createPortfolioGuard(opts.portfolioGuard);
    if (opts.capital) {
      portfolioGuard.updateEquity(opts.capital);
    }
  }

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

          for (const intent of intents) {
            // Strategy deactivation check for entry intents
            if (deactivatedStrategies.has(agent.strategyId) && intent.reason === "entry") {
              continue;
            }

            // Market filter check for entry intents
            if (marketState && intent.reason === "entry") {
              const filter = marketFilters.get(agent.strategyId);
              if (filter) {
                const check = marketState.checkFilter(filter);
                if (!check.allowed) {
                  console.log(`[MARKET] Blocked ${intent.agentId} entry: ${check.reason}`);
                  continue;
                }
              }
            }

            // Earnings guard for entry intents
            if (earningsGuard && intent.reason === "entry") {
              if (earningsGuard.hasUpcomingEarnings(symbol)) {
                const nextDate = earningsGuard.getNextEarnings(symbol);
                console.log(`[EARNINGS] Blocked ${intent.agentId} entry: earnings on ${nextDate}`);
                continue;
              }
            }

            // Sector correlation guard for entry intents
            if (sectorMap.size > 0 && intent.reason === "entry") {
              const openPositions: { symbol: string }[] = [];
              for (const a of agents.values()) {
                const st = a.getState();
                if (
                  st.sessionState?.trackerState?.position != null &&
                  st.sessionState.trackerState.position.shares > 0
                ) {
                  openPositions.push({ symbol: a.symbol });
                }
              }
              const sectorCheck = checkSectorExposure(
                symbol,
                openPositions,
                sectorMap,
                maxSectorPositions,
              );
              if (!sectorCheck.allowed) {
                console.log(`[SECTOR] Blocked ${intent.agentId} entry: ${sectorCheck.reason}`);
                continue;
              }
            }

            // PortfolioGuard check for entry intents
            if (portfolioGuard && intent.reason === "entry") {
              const notional = intent.shares * trade.price;
              const check = portfolioGuard.canOpenPosition(symbol, notional);
              if (!check.allowed) {
                console.log(`[PORTFOLIO] Blocked ${intent.agentId} entry: ${check.reason}`);
                continue;
              }
              portfolioGuard.reportPositionOpen(symbol, notional);
            }

            // Report position close to PortfolioGuard
            if (portfolioGuard && intent.reason !== "entry" && intent.pnl !== undefined) {
              const notional = intent.shares * trade.price;
              portfolioGuard.reportPositionClose(symbol, notional, intent.pnl);
            }

            allIntents.push(intent);
          }
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

    getState(): ManagerState {
      return {
        agents: [...agents.values()].map((a) => a.getState()),
        portfolioGuardState: portfolioGuard?.getState(),
      };
    },

    restoreStates(states, strategies, savedPortfolioGuardState?) {
      // Restore PortfolioGuard state
      if (opts?.portfolioGuard && savedPortfolioGuardState) {
        portfolioGuard = streaming.createPortfolioGuard(
          opts.portfolioGuard,
          savedPortfolioGuardState,
        );
      }

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

    getPortfolioExposure(): streaming.PortfolioExposure | null {
      return portfolioGuard?.getExposure() ?? null;
    },

    replaceAgentStrategy(agentId: string, newStrategy: StrategyDefinition): boolean {
      const agent = agents.get(agentId);
      if (!agent) return false;
      agent.replaceStrategy(newStrategy);
      return true;
    },

    setMarketFilter(strategyId: string, filter: MarketFilter | null): void {
      if (filter) {
        marketFilters.set(strategyId, filter);
      } else {
        marketFilters.delete(strategyId);
      }
    },

    deactivateStrategy(strategyId: string): void {
      deactivatedStrategies.add(strategyId);
    },

    activateStrategy(strategyId: string): void {
      deactivatedStrategies.delete(strategyId);
    },

    getDeactivatedStrategies(): Set<string> {
      return new Set(deactivatedStrategies);
    },
  };
}
