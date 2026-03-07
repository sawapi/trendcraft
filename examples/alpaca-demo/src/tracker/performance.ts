/**
 * Performance tracker — per-agent live metrics accumulation
 */

import type { Agent } from "../agent/agent.js";
import type { AgentMetrics } from "../agent/types.js";

export type PerformanceSummary = {
  agentId: string;
  metrics: AgentMetrics;
  evalDays: number;
};

/**
 * Get performance summary for an agent
 */
export function getPerformanceSummary(agent: Agent): PerformanceSummary {
  const metrics = agent.getMetrics();
  const evalDays = Math.max(
    1,
    (Date.now() - metrics.startedAt) / (24 * 60 * 60 * 1000),
  );

  return {
    agentId: agent.id,
    metrics,
    evalDays,
  };
}
