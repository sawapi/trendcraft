/**
 * CLI command: preflight
 *
 * Pre-launch checks before starting paper trading.
 */

import { createAlpacaClient } from "../alpaca/client.js";
import { loadEnv } from "../config/env.js";
import { compileTemplate } from "../strategy/compiler.js";
import { PRESET_TEMPLATES } from "../strategy/template.js";

type CheckResult = { name: string; passed: boolean; detail: string };

export async function preflightCommand(): Promise<void> {
  const results: CheckResult[] = [];

  // 1. API key check
  let env: ReturnType<typeof loadEnv> | undefined;
  try {
    env = loadEnv();
    results.push({
      name: "API Keys",
      passed: true,
      detail: `Key: ${env.apiKey.slice(0, 4)}...${env.apiKey.slice(-4)}`,
    });
  } catch (err) {
    results.push({
      name: "API Keys",
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    printResults(results);
    return;
  }

  // 2. Alpaca connection test
  const client = createAlpacaClient(env);
  let account: Awaited<ReturnType<typeof client.getAccount>> | undefined;
  try {
    account = await client.getAccount();
    results.push({
      name: "Alpaca Connection",
      passed: true,
      detail: `Connected to ${env.baseUrl}`,
    });
  } catch (err) {
    results.push({
      name: "Alpaca Connection",
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    printResults(results);
    return;
  }

  // 3. Account status
  results.push({
    name: "Account Status",
    passed: account.status === "ACTIVE",
    detail: `Status: ${account.status}, Equity: $${Number(account.equity).toLocaleString()}`,
  });

  // 4. Existing positions warning
  try {
    const positions = await client.getPositions();
    if (positions.length > 0) {
      const symbols = positions.map((p) => p.symbol).join(", ");
      results.push({
        name: "Existing Positions",
        passed: true,
        detail: `WARNING: ${positions.length} open position(s): ${symbols}`,
      });
    } else {
      results.push({
        name: "Existing Positions",
        passed: true,
        detail: "No open positions",
      });
    }
  } catch (err) {
    results.push({
      name: "Existing Positions",
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Strategy compilation check
  let compileErrors = 0;
  for (const template of PRESET_TEMPLATES) {
    const result = compileTemplate(template);
    if (!result.ok) {
      compileErrors++;
      results.push({
        name: `Strategy: ${template.id}`,
        passed: false,
        detail: result.error,
      });
    }
  }
  results.push({
    name: "Strategy Compilation",
    passed: compileErrors === 0,
    detail:
      compileErrors === 0
        ? `All ${PRESET_TEMPLATES.length} strategies compile OK`
        : `${compileErrors} strategy(ies) failed to compile`,
  });

  printResults(results);
}

function printResults(results: CheckResult[]): void {
  console.log("");
  console.log("=".repeat(60));
  console.log("  PREFLIGHT CHECK");
  console.log("=".repeat(60));

  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const marker = r.passed ? "[+]" : "[X]";
    console.log(`  ${marker} ${status}  ${r.name}`);
    console.log(`         ${r.detail}`);
  }

  console.log("-".repeat(60));
  const allPassed = results.every((r) => r.passed);
  console.log(allPassed ? "  RESULT: PASSED" : "  RESULT: FAILED");
  console.log("=".repeat(60));
  console.log("");
}
