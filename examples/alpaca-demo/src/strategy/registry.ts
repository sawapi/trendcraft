/**
 * Strategy registry — all available strategy presets
 */

import type { StrategyDefinition } from "trendcraft";
import { compileTemplate } from "./compiler.js";
import { bollingerSqueeze } from "./presets/bollinger-squeeze.js";
import { macdTrend } from "./presets/macd-trend.js";
import { rsiMeanReversion } from "./presets/rsi-mean-reversion.js";
import { PRESET_TEMPLATES, applyOverrides, getPresetTemplate } from "./template.js";
import type { ParameterOverride, StrategyTemplate } from "./template.js";

const strategies: Map<string, StrategyDefinition> = new Map();

function register(strategy: StrategyDefinition): void {
  strategies.set(strategy.id, strategy);
}

// Register handcoded presets (these have optimized backtest adapters)
const HANDCODED_IDS = new Set(["rsi-mean-reversion", "macd-trend", "bollinger-squeeze"]);
register(rsiMeanReversion);
register(macdTrend);
register(bollingerSqueeze);

// Register template-only presets (compiled from PRESET_TEMPLATES)
for (const template of PRESET_TEMPLATES) {
  if (HANDCODED_IDS.has(template.id)) continue;
  const result = compileTemplate(template);
  if (result.ok) {
    register(result.strategy);
  } else {
    console.warn(`Failed to compile preset ${template.id}: ${result.error}`);
  }
}

export function getStrategy(id: string): StrategyDefinition | undefined {
  return strategies.get(id);
}

export function getAllStrategies(): StrategyDefinition[] {
  return [...strategies.values()];
}

export function getStrategyIds(): string[] {
  return [...strategies.keys()];
}

/**
 * Load and register custom strategies from templates
 */
export function loadCustomStrategiesFromTemplates(
  templates: StrategyTemplate[],
  overrides?: ParameterOverride[],
): { loaded: number; errors: string[] } {
  const errors: string[] = [];
  let loaded = 0;

  for (let template of templates) {
    // Apply any overrides
    const override = overrides?.find((o) => o.strategyId === template.id);
    if (override) {
      template = applyOverrides(template, override);
    }

    const result = compileTemplate(template);
    if (result.ok) {
      register(result.strategy);
      loaded++;
    } else {
      errors.push(`${template.id}: ${result.error}`);
    }
  }

  return { loaded, errors };
}

/**
 * Apply parameter overrides to existing preset strategies.
 *
 * For position/guards-only changes on presets with handcoded pipelines,
 * we patch the original StrategyDefinition directly instead of recompiling
 * from the template (which may lose handcoded backtest adapters).
 *
 * For overrides that change indicators, entry, or exit, we recompile
 * from the template representation.
 */
export function applyStrategyOverrides(overrides: ParameterOverride[]): {
  applied: number;
  errors: string[];
} {
  const errors: string[] = [];
  let applied = 0;

  for (const override of overrides) {
    const existingStrategy = strategies.get(override.strategyId);
    const hasLogicChanges =
      override.overrides.indicators || override.overrides.entry || override.overrides.exit;

    if (existingStrategy && !hasLogicChanges) {
      // Position/guards-only change — patch the existing strategy directly
      const patched = { ...existingStrategy };
      if (override.overrides.position) {
        patched.position = { ...patched.position, ...override.overrides.position };
      }
      if (override.overrides.guards) {
        patched.guards = {
          ...patched.guards,
          riskGuard: { ...patched.guards?.riskGuard, ...override.overrides.guards },
        };
      }
      // Also patch backtestOptions
      if (override.overrides.position) {
        const posOv = override.overrides.position;
        patched.backtestOptions = {
          ...patched.backtestOptions,
          ...(posOv.stopLoss !== undefined && { stopLoss: posOv.stopLoss }),
          ...(posOv.takeProfit !== undefined && { takeProfit: posOv.takeProfit }),
          ...(posOv.trailingStop !== undefined && { trailingStop: posOv.trailingStop }),
          ...(posOv.slippage !== undefined && { slippage: posOv.slippage }),
        };
      }
      register(patched);
      applied++;
      continue;
    }

    // Logic change — recompile from template
    const baseTemplate = getPresetTemplate(override.strategyId);
    if (!baseTemplate) {
      continue;
    }

    const modified = applyOverrides(baseTemplate, override);
    const result = compileTemplate(modified);
    if (result.ok) {
      register(result.strategy);
      applied++;
    } else {
      errors.push(`${override.strategyId}: ${result.error}`);
    }
  }

  return { applied, errors };
}
