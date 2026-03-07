/**
 * Safety Layer — validate and constrain LLM recommendations
 *
 * Pipeline:
 * 1. JSON schema validation (shape check)
 * 2. Parameter range check (palette min/max)
 * 3. Change magnitude check (±20%/day)
 * 4. Rate limits (kill/create per day)
 * 5. Indicator/condition consistency
 * 6. Cumulative drift cap
 */

import type {
  LLMAction,
  LLMRecommendation,
  AdjustParamsAction,
  CreateStrategyAction,
  ReviewRecord,
} from "./types.js";
import type { StrategyTemplate, IndicatorRef } from "../strategy/template.js";
import { INDICATOR_PALETTE, CONDITION_PALETTE } from "../strategy/palette.js";
import { PRESET_TEMPLATES, getPresetTemplate, isCombined } from "../strategy/template.js";

export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

export type SafetyConfig = {
  maxParamChangePct: number;     // max ±% change per day (default: 20)
  maxKillsPerDay: number;        // default: 1
  maxRevivesPerDay: number;      // default: 1
  maxCreatesPerDay: number;      // default: 1
  maxCumulativeDriftPct: number; // max drift from original (default: 50)
  minBacktestScore: number;      // for new strategies (default: 30)
  minDaysBetweenChanges: number; // min days between changes to same strategy (default: 3)
  maxChangesPerWeek: number;     // max total adjust_params actions per week (default: 3)
};

const DEFAULT_CONFIG: SafetyConfig = {
  maxParamChangePct: 20,
  maxKillsPerDay: 1,
  maxRevivesPerDay: 1,
  maxCreatesPerDay: 1,
  maxCumulativeDriftPct: 50,
  minBacktestScore: 30,
  minDaysBetweenChanges: 3,
  maxChangesPerWeek: 3,
};

/**
 * Validate all actions in a recommendation
 *
 * Returns arrays of valid and rejected actions.
 *
 * @param recentReviews - Reviews from the past 7 days (for frequency limiting)
 */
export function validateRecommendation(
  recommendation: LLMRecommendation,
  todayReviews: ReviewRecord[],
  activeTemplates: StrategyTemplate[],
  config: SafetyConfig = DEFAULT_CONFIG,
  recentReviews: ReviewRecord[] = [],
): {
  valid: LLMAction[];
  rejected: { action: LLMAction; reason: string }[];
} {
  const valid: LLMAction[] = [];
  const rejected: { action: LLMAction; reason: string }[] = [];

  // Count today's actions from previous reviews
  let killsToday = 0;
  let revivesToday = 0;
  let createsToday = 0;
  for (const review of todayReviews) {
    for (const applied of review.appliedActions) {
      if (applied.action.action === "kill_agent") killsToday++;
      if (applied.action.action === "revive_agent") revivesToday++;
      if (applied.action.action === "create_strategy") createsToday++;
    }
  }

  // Count weekly adjust_params actions
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let adjustsThisWeek = 0;
  for (const review of recentReviews) {
    if (review.reviewedAt < weekAgo) continue;
    for (const applied of review.appliedActions) {
      if (applied.action.action === "adjust_params") adjustsThisWeek++;
    }
  }

  // Build map of last change date per strategy (for frequency limiting)
  const lastChangeDate = new Map<string, number>();
  for (const review of recentReviews) {
    for (const applied of review.appliedActions) {
      if (applied.action.action === "adjust_params") {
        const sid = applied.action.strategyId;
        const existing = lastChangeDate.get(sid) ?? 0;
        if (review.reviewedAt > existing) {
          lastChangeDate.set(sid, review.reviewedAt);
        }
      }
    }
  }

  for (const action of recommendation.actions) {
    // Check weekly limit for adjust_params
    if (action.action === "adjust_params") {
      if (adjustsThisWeek >= config.maxChangesPerWeek) {
        rejected.push({
          action,
          reason: `Weekly adjust_params limit reached (${config.maxChangesPerWeek}/week)`,
        });
        continue;
      }

      // Check per-strategy frequency limit
      const lastChange = lastChangeDate.get(action.strategyId);
      if (lastChange != null) {
        const daysSince = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
        if (daysSince < config.minDaysBetweenChanges) {
          rejected.push({
            action,
            reason: `Strategy "${action.strategyId}" was changed ${daysSince.toFixed(1)} days ago (minimum ${config.minDaysBetweenChanges} days between changes)`,
          });
          continue;
        }
      }
    }

    const result = validateAction(
      action,
      { killsToday, revivesToday, createsToday },
      activeTemplates,
      config,
    );

    if (result.valid) {
      valid.push(action);
      // Update counters
      if (action.action === "kill_agent") killsToday++;
      if (action.action === "revive_agent") revivesToday++;
      if (action.action === "create_strategy") createsToday++;
      if (action.action === "adjust_params") {
        adjustsThisWeek++;
        lastChangeDate.set(action.strategyId, Date.now());
      }
    } else {
      rejected.push({ action, reason: result.reason! });
    }
  }

  return { valid, rejected };
}

function validateAction(
  action: LLMAction,
  counts: { killsToday: number; revivesToday: number; createsToday: number },
  activeTemplates: StrategyTemplate[],
  config: SafetyConfig,
): ValidationResult {
  switch (action.action) {
    case "adjust_params":
      return validateAdjustParams(action, activeTemplates, config);
    case "kill_agent":
      if (counts.killsToday >= config.maxKillsPerDay) {
        return { valid: false, reason: `Kill limit reached (${config.maxKillsPerDay}/day)` };
      }
      return { valid: true };
    case "revive_agent":
      if (counts.revivesToday >= config.maxRevivesPerDay) {
        return { valid: false, reason: `Revive limit reached (${config.maxRevivesPerDay}/day)` };
      }
      return { valid: true };
    case "create_strategy":
      if (counts.createsToday >= config.maxCreatesPerDay) {
        return { valid: false, reason: `Create limit reached (${config.maxCreatesPerDay}/day)` };
      }
      return validateCreateStrategy(action, config);
    default:
      return { valid: false, reason: `Unknown action type` };
  }
}

function validateAdjustParams(
  action: AdjustParamsAction,
  activeTemplates: StrategyTemplate[],
  config: SafetyConfig,
): ValidationResult {
  // Find the current template
  const current =
    activeTemplates.find((t) => t.id === action.strategyId) ??
    getPresetTemplate(action.strategyId);

  if (!current) {
    return { valid: false, reason: `Strategy "${action.strategyId}" not found` };
  }

  const { changes } = action;

  // Validate indicator params
  if (changes.indicators) {
    for (const ind of changes.indicators) {
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
      const currentInd = current.indicators.find((i) => i.name === ind.name);
      if (currentInd) {
        for (const [param, newValue] of Object.entries(ind.params)) {
          const oldValue = currentInd.params[param];
          if (oldValue !== undefined && oldValue !== 0) {
            const changePct = Math.abs((newValue - oldValue) / oldValue) * 100;
            if (changePct > config.maxParamChangePct) {
              return {
                valid: false,
                reason: `Param "${param}" change ${changePct.toFixed(1)}% exceeds ±${config.maxParamChangePct}% daily limit`,
              };
            }
          }
        }
      }

      // Check cumulative drift from original preset
      const original = PRESET_TEMPLATES.find((t) => t.id === action.strategyId);
      if (original) {
        const origInd = original.indicators.find((i) => i.name === ind.name);
        if (origInd) {
          for (const [param, newValue] of Object.entries(ind.params)) {
            const origValue = origInd.params[param];
            if (origValue !== undefined && origValue !== 0) {
              const driftPct = Math.abs((newValue - origValue) / origValue) * 100;
              if (driftPct > config.maxCumulativeDriftPct) {
                return {
                  valid: false,
                  reason: `Param "${param}" cumulative drift ${driftPct.toFixed(1)}% exceeds ${config.maxCumulativeDriftPct}% cap`,
                };
              }
            }
          }
        }
      }
    }
  }

  // Validate position changes
  if (changes.position) {
    for (const [key, value] of Object.entries(changes.position)) {
      if (typeof value !== "number") continue;
      const currentVal = current.position[key as keyof typeof current.position];
      if (typeof currentVal === "number" && currentVal !== 0) {
        const changePct = Math.abs((value - currentVal) / currentVal) * 100;
        if (changePct > config.maxParamChangePct) {
          return {
            valid: false,
            reason: `Position "${key}" change ${changePct.toFixed(1)}% exceeds ±${config.maxParamChangePct}% daily limit`,
          };
        }
      }
    }
  }

  return { valid: true };
}

function validateCreateStrategy(
  action: CreateStrategyAction,
  _config: SafetyConfig,
): ValidationResult {
  const { template } = action;

  // Validate all indicators exist in palette
  for (const ind of template.indicators) {
    if (!INDICATOR_PALETTE[ind.type]) {
      return { valid: false, reason: `Unknown indicator type: ${ind.type}` };
    }

    // Check param ranges
    const paletteDef = INDICATOR_PALETTE[ind.type];
    for (const [param, value] of Object.entries(ind.params)) {
      const range = paletteDef.params[param];
      if (!range) {
        return { valid: false, reason: `Unknown param "${param}" for "${ind.type}"` };
      }
      if (value < range.min || value > range.max) {
        return {
          valid: false,
          reason: `Param "${param}" value ${value} out of range [${range.min}, ${range.max}]`,
        };
      }
    }
  }

  // Validate conditions reference existing indicators
  const indicatorNames = new Set(template.indicators.map((i) => i.name));
  const indicatorTypes = new Set(template.indicators.map((i) => i.type));

  const conditionRefs = isCombined(template.entry)
    ? template.entry.conditions
    : [template.entry];
  const exitRefs = isCombined(template.exit)
    ? template.exit.conditions
    : [template.exit];

  for (const ref of [...conditionRefs, ...exitRefs]) {
    const condDef = CONDITION_PALETTE[ref.type];
    if (!condDef) {
      return { valid: false, reason: `Unknown condition type: ${ref.type}` };
    }

    // Check required indicators are present
    if (condDef.requiredIndicators) {
      for (const req of condDef.requiredIndicators) {
        if (!indicatorTypes.has(req)) {
          return {
            valid: false,
            reason: `Condition "${ref.type}" requires indicator "${req}" which is not defined`,
          };
        }
      }
    }
  }

  // Validate template has required fields
  if (!template.id || !template.name) {
    return { valid: false, reason: "Template missing id or name" };
  }
  if (!template.indicators.length) {
    return { valid: false, reason: "Template has no indicators" };
  }

  // Enforce source
  if (template.source !== "llm-generated") {
    return { valid: false, reason: "LLM-created strategies must have source: 'llm-generated'" };
  }

  return { valid: true };
}
