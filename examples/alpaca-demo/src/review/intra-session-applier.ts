/**
 * Intra-Session Action Applier
 *
 * Applies validated intra-session LLM actions (adjust_params, kill_agent, revive_agent)
 * with hot-swap support for live strategy replacement.
 */

import type { NormalizedCandle, StrategyDefinition } from "trendcraft";
import type { AgentManager } from "../agent/manager.js";
import type { AlpacaTimeframe } from "../alpaca/historical.js";
import type { OrderExecutor } from "../executor/types.js";
import { compileTemplate } from "../strategy/compiler.js";
import { getStrategy } from "../strategy/registry.js";
import {
  applyOverrides as applyTemplateOverrides,
  getPresetTemplate,
} from "../strategy/template.js";
import {
  buildOverrideFromChanges,
  loadOverrides,
  mergeOverride,
  saveOverrides,
} from "./applier.js";
import type { AppliedAction, IntraSessionAgentReport, LLMAction, RejectedAction } from "./types.js";

export type IntraSessionApplyContext = {
  manager: AgentManager;
  executor: OrderExecutor;
  reviewNum: number;
  agents: IntraSessionAgentReport[];
  fetchWarmUp: (strategy: StrategyDefinition, symbol: string) => Promise<NormalizedCandle[]>;
};

export type IntraSessionApplyResult = {
  appliedActions: AppliedAction[];
  rejectedActions: RejectedAction[];
};

/**
 * Apply validated intra-session actions with hot-swap support
 */
export async function applyIntraSessionActions(
  validActions: LLMAction[],
  rejectedFromValidation: RejectedAction[],
  ctx: IntraSessionApplyContext,
): Promise<IntraSessionApplyResult> {
  const appliedActions: AppliedAction[] = [];
  const rejectedActions: RejectedAction[] = [...rejectedFromValidation];

  for (const action of validActions) {
    try {
      if (action.action === "adjust_params") {
        const currentOverrides = loadOverrides();
        const override = buildOverrideFromChanges(
          action.strategyId,
          action.changes,
          `[intra-#${ctx.reviewNum}] ${action.reasoning}`,
        );
        mergeOverride(currentOverrides, override);
        saveOverrides(currentOverrides);

        // Hot-swap: recompile template and replace agent strategy
        const baseTemplate = getPresetTemplate(action.strategyId);
        if (baseTemplate) {
          const finalOverride = currentOverrides.find((o) => o.strategyId === action.strategyId)!;
          const modified = applyTemplateOverrides(baseTemplate, finalOverride);
          const compiled = compileTemplate(modified);
          if (compiled.ok) {
            const primarySymbol =
              ctx.agents.find((a) => a.strategyId === action.strategyId)?.symbol ?? "";
            const swapped = ctx.manager.replaceAgentStrategy(
              `${action.strategyId}:${primarySymbol}`,
              compiled.strategy,
            );
            // Try all agents for this strategy
            if (!swapped) {
              for (const agent of ctx.manager.getAgents()) {
                if (agent.strategyId === action.strategyId) {
                  ctx.manager.replaceAgentStrategy(agent.id, compiled.strategy);
                }
              }
            }
            // Update market filter if changed
            if (action.changes.marketFilter !== undefined) {
              ctx.manager.setMarketFilter(action.strategyId, action.changes.marketFilter);
            }
            console.log(`[INTRA] Applied adjust_params for ${action.strategyId}`);
          } else {
            console.warn(
              `[INTRA] Template compile failed for ${action.strategyId}: ${compiled.error}`,
            );
          }
        }

        appliedActions.push({ action });
      } else if (action.action === "kill_agent") {
        const agent = ctx.manager.getAgent(action.agentId);
        if (agent) {
          const { intents } = agent.close();
          for (const intent of intents) {
            await ctx.executor.execute(intent);
          }
          ctx.manager.removeAgent(action.agentId);
          console.log(`[INTRA] Killed agent ${action.agentId}`);
          appliedActions.push({ action });
        } else {
          rejectedActions.push({ action, reason: `Agent "${action.agentId}" not found` });
        }
      } else if (action.action === "revive_agent") {
        const [strategyId, symbol] = action.agentId.split(":");
        const strategy = getStrategy(strategyId);
        if (strategy && symbol) {
          const warmUp = await ctx.fetchWarmUp(strategy, symbol);
          ctx.manager.addAgent(strategy, symbol, warmUp);
          console.log(`[INTRA] Revived agent ${action.agentId}`);
          appliedActions.push({ action });
        } else {
          rejectedActions.push({ action, reason: `Strategy "${strategyId}" not found` });
        }
      }
    } catch (err) {
      console.error(`[INTRA] Failed to apply ${action.action}:`, err);
      rejectedActions.push({
        action,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { appliedActions, rejectedActions };
}
