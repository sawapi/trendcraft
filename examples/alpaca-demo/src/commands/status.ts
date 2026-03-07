/**
 * CLI command: status
 *
 * Display agent status and leaderboard from saved state.
 */

import { createStateStore } from "../persistence/store.js";

export async function statusCommand(): Promise<void> {
  const store = createStateStore();
  const state = store.load();

  if (!state) {
    console.log("No saved state found. Run 'live' first.");
    return;
  }

  console.log(`\nState saved at: ${new Date(state.savedAt).toISOString()}`);
  console.log(`Agents: ${state.agents.length}\n`);

  // Format agent table
  const lines: string[] = [];
  lines.push(
    `  ${"Agent".padEnd(30)}${"Tier".padEnd(10)}${"Trades".padEnd(8)}` +
      `${"WinRate".padEnd(10)}${"Return%".padEnd(10)}${"Sharpe".padEnd(9)}` +
      `${"MaxDD".padEnd(9)}${"DailyPnL".padEnd(12)}`,
  );
  lines.push("-".repeat(98));

  for (const agent of state.agents) {
    const m = agent.metrics;
    lines.push(
      `  ${agent.id.padEnd(30)}${agent.tier.padEnd(10)}${String(m.totalTrades).padEnd(8)}` +
        `${`${m.winRate.toFixed(1)}%`.padEnd(10)}${`${m.totalReturnPercent.toFixed(2)}%`.padEnd(10)}` +
        `${m.sharpeRatio.toFixed(2).padEnd(9)}${`${m.maxDrawdown.toFixed(1)}%`.padEnd(9)}` +
        `${`$${m.dailyPnl.toFixed(0)}`.padEnd(12)}`,
    );
  }

  console.log(lines.join("\n"));
  console.log("");
}
