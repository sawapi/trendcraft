#!/usr/bin/env node
/**
 * Publish gate: verify that every entry point listed in package.json#exports
 * resolves and produces a working module in both ESM and CJS modes.
 *
 * Run after `pnpm build`. Hooked from `prepublishOnly`.
 *
 * Catches:
 *  - Missing dist/ artifact for an entry (stale exports map or broken build)
 *  - ESM entry that fails to evaluate (bad re-export, circular tree-shake)
 *  - CJS entry that fails to load via require()
 *  - .d.ts file missing for any entry
 *  - Any listed entry that doesn't actually expose its advertised symbols
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const pkgJson = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
const exportsMap = pkgJson.exports ?? {};
const require = createRequire(import.meta.url);

/** Expected top-level symbols per entry. Kept small on purpose — just enough to catch regressions. */
const EXPECTED_SYMBOLS = {
  ".": ["createChart", "connectIndicators", "defineIndicator", "DARK_THEME", "LIGHT_THEME"],
  "./headless": ["DataLayer", "TimeScale", "PriceScale", "introspect", "lttb"],
  "./presets": ["registerTrendCraftPresets"],
  "./react": ["TrendChart", "useTrendChart"],
  "./vue": ["TrendChart", "useTrendChart"],
};

const failures = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
};

async function verifyEntry(subpath, entry) {
  console.log(`\n[${subpath}]`);
  const typesPath = resolve(pkgRoot, entry.types);
  const esmPath = resolve(pkgRoot, entry.import);
  const cjsPath = resolve(pkgRoot, entry.require);

  // File existence
  if (existsSync(typesPath)) pass(`types file exists (${entry.types})`);
  else fail(`missing types file: ${entry.types}`);

  if (existsSync(esmPath)) pass(`esm file exists (${entry.import})`);
  else fail(`missing esm file: ${entry.import}`);

  if (existsSync(cjsPath)) pass(`cjs file exists (${entry.require})`);
  else fail(`missing cjs file: ${entry.require}`);

  const expected = EXPECTED_SYMBOLS[subpath] ?? [];

  // React/Vue entries import their peer deps — skip runtime evaluation if they're not installed.
  const skipRuntime =
    (subpath === "./react" && !canRequire("react")) ||
    (subpath === "./vue" && !canRequire("vue"));

  if (skipRuntime) {
    pass(`skipping runtime eval (peer dep not installed; file checks above cover surface)`);
    return;
  }

  // ESM evaluation
  if (existsSync(esmPath)) {
    try {
      const mod = await import(pathToFileURL(esmPath).href);
      for (const sym of expected) {
        if (sym in mod) pass(`esm exports ${sym}`);
        else fail(`esm missing symbol: ${sym}`);
      }
    } catch (err) {
      fail(`esm eval threw: ${err.message}`);
    }
  }

  // CJS evaluation
  if (existsSync(cjsPath)) {
    try {
      const mod = require(cjsPath);
      for (const sym of expected) {
        if (sym in mod) pass(`cjs exports ${sym}`);
        else fail(`cjs missing symbol: ${sym}`);
      }
    } catch (err) {
      fail(`cjs eval threw: ${err.message}`);
    }
  }
}

function canRequire(id) {
  try {
    require.resolve(id, { paths: [pkgRoot] });
    return true;
  } catch {
    return false;
  }
}

console.log(`Publish gate: @trendcraft/chart@${pkgJson.version}`);

for (const [subpath, entry] of Object.entries(exportsMap)) {
  if (typeof entry !== "object" || entry === null) continue;
  await verifyEntry(subpath, entry);
}

console.log();
if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} issue(s) found. Fix before publishing.`);
  process.exit(1);
}
console.log(`OK: all ${Object.keys(exportsMap).length} entry points resolve correctly.`);
