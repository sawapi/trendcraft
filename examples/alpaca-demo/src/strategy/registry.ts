/**
 * Strategy registry — all available strategy presets
 */

import type { StrategyDefinition } from "trendcraft";
import { createLogger } from "../util/logger.js";
import { compileTemplate } from "./compiler.js";

const log = createLogger("REGISTRY");
import { bollingerSqueeze } from "./presets/bollinger-squeeze.js";
import { bollingerSwingHourly } from "./presets/bollinger-swing-hourly.js";
import { emaSwingDaily } from "./presets/ema-swing-daily.js";
import { macdTrend } from "./presets/macd-trend.js";
import { rsiMeanReversion } from "./presets/rsi-mean-reversion.js";
import { rsiSwingDaily } from "./presets/rsi-swing-daily.js";
import { PRESET_TEMPLATES, applyOverrides, getPresetTemplate } from "./template.js";
import type { MarketFilter, ParameterOverride, StrategyTemplate } from "./template.js";

const marketFilterMap = new Map<string, MarketFilter>();

const strategies: Map<string, StrategyDefinition> = new Map();

function register(strategy: StrategyDefinition): void {
  strategies.set(strategy.id, strategy);
}

// Register handcoded presets (these have optimized backtest adapters)
const HANDCODED_IDS = new Set([
  "rsi-mean-reversion",
  "macd-trend",
  "bollinger-squeeze",
  "ema-swing-daily",
  "rsi-swing-daily",
  "bollinger-swing-hourly",
]);
register(rsiMeanReversion);
register(macdTrend);
register(bollingerSqueeze);
register(emaSwingDaily);
register(rsiSwingDaily);
register(bollingerSwingHourly);

// Register template-only presets (compiled from PRESET_TEMPLATES)
for (const template of PRESET_TEMPLATES) {
  if (HANDCODED_IDS.has(template.id)) continue;
  const result = compileTemplate(template);
  if (result.ok) {
    register(result.strategy);
  } else {
    log.warn(`Failed to compile preset ${template.id}: ${result.error}`);
  }
  if (template.marketFilter) {
    marketFilterMap.set(template.id, template.marketFilter);
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
 * Get all registered market filters (strategyId → MarketFilter)
 */
export function getMarketFilters(): Map<string, MarketFilter> {
  return new Map(marketFilterMap);
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
    if (template.marketFilter) {
      marketFilterMap.set(template.id, template.marketFilter);
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
    // Track market filter from overrides (null removes, object sets)
    if (override.overrides.marketFilter === null) {
      marketFilterMap.delete(override.strategyId);
    } else if (override.overrides.marketFilter) {
      marketFilterMap.set(override.strategyId, override.overrides.marketFilter);
    }

    const existingStrategy = strategies.get(override.strategyId);
    const hasLogicChanges =
      override.overrides.indicators || override.overrides.entry || override.overrides.exit;

    if (existingStrategy && !hasLogicChanges) {
      // Position/guards-only change — patch the existing strategy directly
      const patched = { ...existingStrategy };
      if (override.overrides.position) {
        const posOv = override.overrides.position;
        // Convert template-style partialTakeProfit/breakEvenStop to core types
        const convertedPtp = posOv.partialTakeProfit
          ? {
              threshold: posOv.partialTakeProfit.threshold,
              sellPercent: posOv.partialTakeProfit.portion,
            }
          : undefined;
        const convertedBe = posOv.breakEvenStop
          ? {
              threshold: posOv.breakEvenStop.triggerPercent,
              buffer: posOv.breakEvenStop.offset,
            }
          : undefined;

        const { partialTakeProfit: _ptp, breakEvenStop: _be, ...restPosOv } = posOv;
        patched.position = {
          ...patched.position,
          ...restPosOv,
          ...(convertedPtp && { partialTakeProfit: convertedPtp }),
          ...(convertedBe && { breakevenStop: convertedBe }),
        };
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
          ...(posOv.partialTakeProfit && {
            partialTakeProfit: {
              threshold: posOv.partialTakeProfit.threshold,
              sellPercent: posOv.partialTakeProfit.portion,
            },
          }),
          ...(posOv.breakEvenStop && {
            breakevenStop: {
              threshold: posOv.breakEvenStop.triggerPercent,
              buffer: posOv.breakEvenStop.offset,
            },
          }),
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
