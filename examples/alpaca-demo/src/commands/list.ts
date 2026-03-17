/**
 * CLI command: list
 *
 * Display available strategies and universes for discovery.
 */

import { getUniverseIds } from "../config/universe.js";
import { getAllStrategies } from "../strategy/registry.js";
import { PRESET_TEMPLATES, getPresetTemplate } from "../strategy/template.js";

/**
 * Classify a strategy as "day", "swing", or "hourly" based on intervalMs.
 */
function classifyType(intervalMs: number): string {
  if (intervalMs >= 86_400_000) return "swing-daily";
  if (intervalMs >= 3_600_000) return "swing-hourly";
  return "day";
}

/**
 * Format intervalMs to a human-readable timeframe string.
 */
function formatTimeframe(intervalMs: number): string {
  if (intervalMs >= 86_400_000) return "1Day";
  if (intervalMs >= 3_600_000) return "1Hour";
  if (intervalMs >= 300_000) return "5Min";
  return "1Min";
}

export async function listCommand(sub: string): Promise<void> {
  switch (sub) {
    case "strategies":
      listStrategies();
      break;
    case "universes":
      listUniverses();
      break;
    default:
      console.log(`Unknown list target: "${sub}"`);
      console.log("Available: strategies, universes");
      process.exit(1);
  }
}

function listStrategies(): void {
  const strategies = getAllStrategies();

  if (strategies.length === 0) {
    console.log("No strategies registered.");
    return;
  }

  console.log(`\n  Available Strategies (${strategies.length})\n`);
  console.log(
    `  ${"ID".padEnd(28)} ${"Name".padEnd(32)} ${"Type".padEnd(14)} ${"TF".padEnd(6)} Description`,
  );
  console.log(
    `  ${"─".repeat(28)} ${"─".repeat(32)} ${"─".repeat(14)} ${"─".repeat(6)} ${"─".repeat(40)}`,
  );

  for (const strategy of strategies) {
    const template = getPresetTemplate(strategy.id);
    const type = classifyType(strategy.intervalMs);
    const tf = formatTimeframe(strategy.intervalMs);
    const description = template?.description ?? "";
    const direction = template?.direction;
    const dirTag = direction === "short" ? " [SHORT]" : direction === "both" ? " [LONG/SHORT]" : "";

    console.log(
      `  ${strategy.id.padEnd(28)} ${(strategy.name ?? strategy.id).padEnd(32)} ${(type + dirTag).padEnd(14)} ${tf.padEnd(6)} ${description.slice(0, 60)}`,
    );
  }

  console.log("");
}

function listUniverses(): void {
  const ids = getUniverseIds();

  console.log(`\n  Available Universes (${ids.length})\n`);
  console.log(`  ${"ID".padEnd(12)} Description`);
  console.log(`  ${"─".repeat(12)} ${"─".repeat(50)}`);

  const descriptions: Record<string, string> = {
    mega30: "20 mega-cap stocks + 10 major ETFs (30 symbols)",
    sp100: "mega30 + 70 additional large-caps (100 symbols)",
    sec: "SEC EDGAR universe with sector/industry filtering (dynamic)",
  };

  for (const id of ids) {
    console.log(`  ${id.padEnd(12)} ${descriptions[id] ?? ""}`);
  }

  console.log("");
}
