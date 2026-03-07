/**
 * CLI command: promote
 *
 * Manually promote or demote an agent's tier.
 */

import { createStateStore } from "../persistence/store.js";
import type { AgentTier } from "../agent/types.js";

export type PromoteCommandOptions = {
  agent: string;
  tier: string;
};

export async function promoteCommand(opts: PromoteCommandOptions): Promise<void> {
  const validTiers: AgentTier[] = ["backtest", "paper", "live"];
  const tier = opts.tier as AgentTier;

  if (!validTiers.includes(tier)) {
    console.error(`Invalid tier: ${opts.tier}. Must be one of: ${validTiers.join(", ")}`);
    process.exit(1);
  }

  const store = createStateStore();
  const state = store.load();

  if (!state) {
    console.log("No saved state found.");
    return;
  }

  const agent = state.agents.find((a) => a.id === opts.agent);
  if (!agent) {
    console.error(`Agent not found: ${opts.agent}`);
    console.log("Available agents:", state.agents.map((a) => a.id).join(", "));
    return;
  }

  const oldTier = agent.tier;
  agent.tier = tier;
  store.save(state.agents);

  console.log(`Agent ${opts.agent}: ${oldTier} -> ${tier}`);
}
