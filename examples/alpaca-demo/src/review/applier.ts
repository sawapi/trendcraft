/**
 * Action Applier — apply validated LLM recommendations
 *
 * - adjust_params → save to strategy-overrides.json
 * - kill_agent → set active = false in state.json
 * - revive_agent → set active = true + apply overrides
 * - create_strategy → backtest gate → save to custom-strategies.json
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type NormalizedCandle, runBacktest } from "trendcraft";
import type { AgentState } from "../agent/types.js";
import { runMonteCarloValidation, runWalkForwardValidation } from "../backtest/runner.js";
import { scoreResult } from "../backtest/scorer.js";
import { atomicWriteJson } from "../persistence/atomic-write.js";
import { compileTemplate } from "../strategy/compiler.js";
import {
  type ParameterOverride,
  type StrategyTemplate,
  applyOverrides as applyTemplateOverrides,
  getPresetTemplate,
} from "../strategy/template.js";
import type {
  AdjustParamsAction,
  AppliedAction,
  CreateStrategyAction,
  KillAgentAction,
  LLMAction,
  RejectedAction,
  ReviveAgentAction,
} from "./types.js";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const OVERRIDES_PATH = resolve(DATA_DIR, "strategy-overrides.json");
const CUSTOM_STRATEGIES_PATH = resolve(DATA_DIR, "custom-strategies.json");
const STATE_PATH = resolve(DATA_DIR, "state.json");

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export type ApplyResult = {
  applied: AppliedAction[];
  rejected: RejectedAction[];
};

/**
 * Apply a list of validated actions
 */
export async function applyActions(
  actions: LLMAction[],
  backtestCandles?: NormalizedCandle[],
  minBacktestScore = 30,
): Promise<ApplyResult> {
  const applied: AppliedAction[] = [];
  const rejected: RejectedAction[] = [];

  for (const action of actions) {
    try {
      const result = await applyAction(action, backtestCandles, minBacktestScore);
      if (result.ok) {
        applied.push({
          action,
          backtestScore: result.backtestScore,
          wfaEfficiency: result.wfaEfficiency,
        });
      } else {
        rejected.push({ action, reason: result.reason ?? "unknown" });
      }
    } catch (err) {
      rejected.push({
        action,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { applied, rejected };
}

type ActionResult =
  | { ok: true; backtestScore?: number; wfaEfficiency?: number }
  | { ok: false; reason: string };

async function applyAction(
  action: LLMAction,
  backtestCandles?: NormalizedCandle[],
  minBacktestScore = 30,
): Promise<ActionResult> {
  switch (action.action) {
    case "adjust_params":
      return applyAdjustParams(action, backtestCandles);
    case "kill_agent":
      return applyKillAgent(action);
    case "revive_agent":
      return applyReviveAgent(action);
    case "create_strategy":
      return applyCreateStrategy(action, backtestCandles, minBacktestScore);
    default:
      return { ok: false, reason: "Unknown action type" };
  }
}

function applyAdjustParams(
  action: AdjustParamsAction,
  backtestCandles?: NormalizedCandle[],
): ActionResult {
  ensureDir(DATA_DIR);

  const overrides = loadOverrides();
  const override: ParameterOverride = {
    strategyId: action.strategyId,
    overrides: {
      ...(action.changes.indicators && {
        indicators: action.changes.indicators,
      }),
      ...(action.changes.position && { position: action.changes.position }),
      ...(action.changes.guards && { guards: action.changes.guards }),
      ...(action.changes.entry && { entry: action.changes.entry }),
      ...(action.changes.exit && { exit: action.changes.exit }),
    },
    appliedAt: Date.now(),
    reasoning: action.reasoning,
  };

  // Replace existing override for same strategy, or add new
  const idx = overrides.findIndex((o) => o.strategyId === action.strategyId);
  if (idx >= 0) {
    // Merge with existing override
    const existing = overrides[idx];
    overrides[idx] = {
      ...existing,
      overrides: { ...existing.overrides, ...override.overrides },
      appliedAt: override.appliedAt,
      reasoning: `${existing.reasoning} | ${override.reasoning}`,
    };
  } else {
    overrides.push(override);
  }

  // Walk-Forward gate for logic/risk changes (indicators, entry, exit, position, guards)
  const hasLogicChanges =
    action.changes.indicators ||
    action.changes.entry ||
    action.changes.exit ||
    action.changes.position ||
    action.changes.guards;

  if (hasLogicChanges && backtestCandles && backtestCandles.length > 0) {
    const baseTemplate = getPresetTemplate(action.strategyId);
    if (baseTemplate) {
      const modified = applyTemplateOverrides(baseTemplate, override);
      const compiled = compileTemplate(modified);
      if (compiled.ok) {
        const wfa = runWalkForwardValidation(
          compiled.strategy,
          backtestCandles,
          modified.position.capital,
        );
        if (!wfa.passed) {
          return {
            ok: false,
            reason: `Walk-Forward validation failed for adjust_params: ${wfa.reason}`,
          };
        }
        console.log(`[APPLY] WFA passed for ${action.strategyId}: ${wfa.reason}`);
      }
    }
  }

  saveOverrides(overrides);
  console.log(`[APPLY] Parameter override saved for ${action.strategyId}`);

  return { ok: true };
}

function applyKillAgent(action: KillAgentAction): ActionResult {
  const state = loadState();
  if (!state) {
    return { ok: false, reason: "No state file found" };
  }

  const agent = state.agents.find(
    (a: AgentState & { active?: boolean }) => a.id === action.agentId,
  );
  if (!agent) {
    return { ok: false, reason: `Agent "${action.agentId}" not found in state` };
  }

  (agent as AgentState & { active: boolean }).active = false;
  saveState(state);
  console.log(`[APPLY] Agent ${action.agentId} deactivated`);

  return { ok: true };
}

function applyReviveAgent(action: ReviveAgentAction): ActionResult {
  const state = loadState();
  if (!state) {
    return { ok: false, reason: "No state file found" };
  }

  const agent = state.agents.find(
    (a: AgentState & { active?: boolean }) => a.id === action.agentId,
  );
  if (!agent) {
    return { ok: false, reason: `Agent "${action.agentId}" not found in state` };
  }

  (agent as AgentState & { active: boolean }).active = true;
  saveState(state);
  console.log(`[APPLY] Agent ${action.agentId} reactivated`);

  // Apply param changes if provided
  if (action.paramChanges) {
    const strategyId = action.agentId.split(":")[0];
    return applyAdjustParams({
      action: "adjust_params",
      strategyId,
      changes: action.paramChanges,
      reasoning: `Revive: ${action.reasoning}`,
    });
  }

  return { ok: true };
}

function applyCreateStrategy(
  action: CreateStrategyAction,
  backtestCandles?: NormalizedCandle[],
  minBacktestScore = 30,
): ActionResult {
  const template = action.template;

  // Compile to verify it's valid
  const compiled = compileTemplate(template);
  if (!compiled.ok) {
    return { ok: false, reason: `Template compile error: ${compiled.error}` };
  }

  // Run backtest gate if candles available
  if (backtestCandles && backtestCandles.length > 0) {
    const { entryCondition, exitCondition, options } = compiled.strategy.backtestAdapter;

    const btResult = runBacktest(backtestCandles, entryCondition, exitCondition, {
      ...options,
      capital: template.position.capital,
    });

    // Monte Carlo validation
    const mcSummary = runMonteCarloValidation(btResult, 500);

    const scored = scoreResult(
      template.id,
      template.symbols[0] ?? "TEST",
      btResult,
      undefined,
      mcSummary,
    );

    if (scored.score < minBacktestScore) {
      return {
        ok: false,
        reason: `Backtest score ${scored.score.toFixed(1)} below minimum ${minBacktestScore}`,
      };
    }

    // Walk-Forward validation gate
    const wfa = runWalkForwardValidation(
      compiled.strategy,
      backtestCandles,
      template.position.capital,
    );

    if (!wfa.passed) {
      return {
        ok: false,
        reason: `Walk-Forward validation failed: ${wfa.reason}`,
      };
    }

    // Save the template
    saveCustomStrategy(template);
    const wfaInfo = wfa.efficiency > 0 ? `, WFA efficiency: ${wfa.efficiency.toFixed(2)}` : "";
    const mcInfo = mcSummary.isSignificant ? ", MC: significant" : ", MC: not significant";
    console.log(
      `[APPLY] New strategy "${template.id}" saved (score: ${scored.score.toFixed(1)}${wfaInfo}${mcInfo})`,
    );
    return { ok: true, backtestScore: scored.score, wfaEfficiency: wfa.efficiency };
  }

  // No backtest data — save but warn
  saveCustomStrategy(template);
  console.log(`[APPLY] New strategy "${template.id}" saved (no backtest data available)`);
  return { ok: true };
}

// --- File I/O helpers ---

export function loadOverrides(): ParameterOverride[] {
  if (!existsSync(OVERRIDES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveOverrides(overrides: ParameterOverride[]): void {
  atomicWriteJson(OVERRIDES_PATH, overrides);
}

/**
 * Remove a single strategy override (used by auto-rollback)
 *
 * @returns true if the override was found and removed
 */
export function removeOverride(strategyId: string): boolean {
  const overrides = loadOverrides();
  const idx = overrides.findIndex((o) => o.strategyId === strategyId);
  if (idx < 0) return false;
  overrides.splice(idx, 1);
  saveOverrides(overrides);
  return true;
}

function loadState(): {
  version: number;
  savedAt: number;
  agents: (AgentState & { active?: boolean })[];
} | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveState(state: {
  version: number;
  savedAt: number;
  agents: (AgentState & { active?: boolean })[];
}): void {
  atomicWriteJson(STATE_PATH, state);
}

export function loadCustomStrategies(): StrategyTemplate[] {
  if (!existsSync(CUSTOM_STRATEGIES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(CUSTOM_STRATEGIES_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveCustomStrategy(template: StrategyTemplate): void {
  ensureDir(DATA_DIR);
  const existing = loadCustomStrategies();
  const idx = existing.findIndex((s) => s.id === template.id);
  if (idx >= 0) {
    existing[idx] = template;
  } else {
    existing.push(template);
  }
  atomicWriteJson(CUSTOM_STRATEGIES_PATH, existing);
}
