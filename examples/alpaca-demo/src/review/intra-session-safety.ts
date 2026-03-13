/**
 * Intra-Session Safety Layer
 *
 * Validates LLM actions during market hours with tighter constraints than daily review:
 * - create_strategy is forbidden
 * - Parameter changes capped at ±10% (half of daily)
 * - Session-level rate limits
 * - Blocks entry/exit logic changes while position is open
 */

import { INDICATOR_PALETTE } from "../strategy/palette.js";
import type { IndicatorRef } from "../strategy/template.js";
import { getPresetTemplate } from "../strategy/template.js";
import type {
  AdjustParamsAction,
  IntraSessionReviewRecord,
  LLMAction,
  LLMRecommendation,
} from "./types.js";

export type IntraSessionSafetyConfig = {
  /** Max ±% change per parameter (default: 10, half of daily) */
  maxParamChangePct: number;
  /** Max kill actions per session (default: 2) */
  maxKillsPerSession: number;
  /** Max revive actions per session (default: 2) */
  maxRevivesPerSession: number;
  /** Max adjust_params actions per session (default: 3) */
  maxAdjustsPerSession: number;
  /** Minimum minutes between reviews (default: 20) */
  minMinutesBetweenReviews: number;
};

const DEFAULT_CONFIG: IntraSessionSafetyConfig = {
  maxParamChangePct: 10,
  maxKillsPerSession: 2,
  maxRevivesPerSession: 2,
  maxAdjustsPerSession: 3,
  minMinutesBetweenReviews: 20,
};

/** Set of position parameters that are safe to change while holding a position */
const SAFE_POSITION_PARAMS = new Set([
  "stopLoss",
  "takeProfit",
  "trailingStop",
  "atrTrailingStop",
  "breakEvenStop",
]);

/**
 * Validate intra-session LLM actions with tighter constraints.
 *
 * @param recommendation - LLM recommendation to validate
 * @param todayIntraReviews - Previous intra-session reviews from today
 * @param agentPositions - Map of agentId → whether they have an open position
 * @param config - Safety configuration overrides
 */
export function validateIntraSessionActions(
  recommendation: LLMRecommendation,
  todayIntraReviews: IntraSessionReviewRecord[],
  agentPositions?: Map<string, boolean>,
  config?: Partial<IntraSessionSafetyConfig>,
): {
  valid: LLMAction[];
  rejected: { action: LLMAction; reason: string }[];
} {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const valid: LLMAction[] = [];
  const rejected: { action: LLMAction; reason: string }[] = [];

  // Count session-level action totals
  let killCount = 0;
  let reviveCount = 0;
  let adjustCount = 0;
  for (const review of todayIntraReviews) {
    for (const applied of review.appliedActions) {
      if (applied.action.action === "kill_agent") killCount++;
      if (applied.action.action === "revive_agent") reviveCount++;
      if (applied.action.action === "adjust_params") adjustCount++;
    }
  }

  for (const action of recommendation.actions) {
    // Block create_strategy entirely
    if (action.action === "create_strategy") {
      rejected.push({
        action,
        reason:
          "create_strategy is not allowed during intra-session review (requires backtest validation)",
      });
      continue;
    }

    // Rate limits
    if (action.action === "kill_agent") {
      if (killCount >= cfg.maxKillsPerSession) {
        rejected.push({
          action,
          reason: `Session kill limit reached (${cfg.maxKillsPerSession}/session)`,
        });
        continue;
      }
      killCount++;
      valid.push(action);
      continue;
    }

    if (action.action === "revive_agent") {
      if (reviveCount >= cfg.maxRevivesPerSession) {
        rejected.push({
          action,
          reason: `Session revive limit reached (${cfg.maxRevivesPerSession}/session)`,
        });
        continue;
      }
      reviveCount++;
      valid.push(action);
      continue;
    }

    if (action.action === "adjust_params") {
      if (adjustCount >= cfg.maxAdjustsPerSession) {
        rejected.push({
          action,
          reason: `Session adjust limit reached (${cfg.maxAdjustsPerSession}/session)`,
        });
        continue;
      }

      const result = validateIntraAdjustParams(action, cfg, agentPositions);
      if (result.valid) {
        adjustCount++;
        valid.push(action);
      } else {
        rejected.push({ action, reason: result.reason ?? "unknown" });
      }
      continue;
    }

    // Unknown action type
    rejected.push({ action, reason: "Unknown action type" });
  }

  return { valid, rejected };
}

function validateIntraAdjustParams(
  action: AdjustParamsAction,
  config: IntraSessionSafetyConfig,
  agentPositions?: Map<string, boolean>,
): { valid: boolean; reason?: string } {
  const { changes, strategyId } = action;

  // Check if any agent for this strategy has an open position
  const hasOpenPosition = agentPositions
    ? [...agentPositions.entries()].some(
        ([id, hasPos]) => id.startsWith(`${strategyId}:`) && hasPos,
      )
    : false;

  // Block entry/exit logic changes while position is open
  if (hasOpenPosition) {
    if (changes.entry) {
      return {
        valid: false,
        reason: `Cannot change entry conditions for "${strategyId}" while position is open`,
      };
    }
    if (changes.exit) {
      return {
        valid: false,
        reason: `Cannot change exit conditions for "${strategyId}" while position is open`,
      };
    }
    if (changes.indicators) {
      return {
        valid: false,
        reason: `Cannot change indicators for "${strategyId}" while position is open`,
      };
    }
    // Check position params — only allow safe ones
    if (changes.position) {
      for (const key of Object.keys(changes.position)) {
        if (!SAFE_POSITION_PARAMS.has(key)) {
          return {
            valid: false,
            reason: `Cannot change position.${key} for "${strategyId}" while position is open (only stopLoss/takeProfit/trailingStop allowed)`,
          };
        }
      }
    }
  }

  // Validate indicator param change magnitude (±10%)
  if (changes.indicators) {
    const current = getPresetTemplate(strategyId);
    if (current) {
      for (const ind of changes.indicators) {
        const result = validateIndicatorChange(ind, current.indicators, config.maxParamChangePct);
        if (!result.valid) return result;
      }
    }
  }

  // Validate position param change magnitude (±10%)
  if (changes.position) {
    const current = getPresetTemplate(strategyId);
    if (current) {
      for (const [key, value] of Object.entries(changes.position)) {
        if (typeof value !== "number") continue;
        const currentVal = current.position[key as keyof typeof current.position];
        if (typeof currentVal === "number" && currentVal !== 0) {
          const changePct = Math.abs((value - currentVal) / currentVal) * 100;
          if (changePct > config.maxParamChangePct) {
            return {
              valid: false,
              reason: `Position "${key}" change ${changePct.toFixed(1)}% exceeds ±${config.maxParamChangePct}% intra-session limit`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}

function validateIndicatorChange(
  ind: IndicatorRef,
  currentIndicators: IndicatorRef[],
  maxChangePct: number,
): { valid: boolean; reason?: string } {
  const paletteDef = INDICATOR_PALETTE[ind.type];
  if (!paletteDef) {
    return { valid: false, reason: `Unknown indicator type: ${ind.type}` };
  }

  // Check param ranges
  for (const [param, value] of Object.entries(ind.params)) {
    const range = paletteDef.params[param];
    if (!range) {
      return { valid: false, reason: `Unknown param "${param}" for indicator "${ind.type}"` };
    }
    if (value < range.min || value > range.max) {
      return {
        valid: false,
        reason: `Param "${param}" value ${value} out of range [${range.min}, ${range.max}]`,
      };
    }
  }

  // Check change magnitude
  const currentInd = currentIndicators.find((i) => i.name === ind.name);
  if (currentInd) {
    for (const [param, newValue] of Object.entries(ind.params)) {
      const oldValue = currentInd.params[param];
      if (oldValue !== undefined && oldValue !== 0) {
        const changePct = Math.abs((newValue - oldValue) / oldValue) * 100;
        if (changePct > maxChangePct) {
          return {
            valid: false,
            reason: `Param "${param}" change ${changePct.toFixed(1)}% exceeds ±${maxChangePct}% intra-session limit`,
          };
        }
      }
    }
  }

  return { valid: true };
}
