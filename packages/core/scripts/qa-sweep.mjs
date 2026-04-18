/**
 * Developer QA sweep for trendcraft.
 * Parses src/indicators/index.ts to get the canonical indicator list,
 * then runs each in a child worker with a per-call timeout. Writes a JSON report.
 *
 * Run from the core package root:
 *   pnpm qa:indicators                 # sweeps all indicators
 *   node scripts/qa-sweep.mjs          # same thing, direct invocation
 *   node scripts/qa-sweep.mjs <name>   # runs one (used internally by workers)
 *
 * Requires `pnpm build` to have run first — the sweep exercises the built
 * bundle under dist/ so it reflects what npm consumers actually get.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const INDICATOR_BARREL = resolve(pkgRoot, "src/indicators/index.ts");
const DIST_ENTRY = resolve(pkgRoot, "dist/index.js");
const PER_CALL_TIMEOUT_MS = 8000;
const REPORT_PATH = resolve(pkgRoot, "qa-report.json");

function makeCandles(n = 400) {
  const out = [];
  let price = 100;
  let seed = 42;
  const rng = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    price += Math.sin(i / 20) * 1.5 + (rng() - 0.5) * 1.2;
    const o = price;
    const c = price + (rng() - 0.5) * 2;
    const h = Math.max(o, c) + rng() * 1.5;
    const l = Math.min(o, c) - rng() * 1.5;
    out.push({
      time: Date.UTC(2024, 0, 1) + i * 86_400_000,
      open: o, high: h, low: l, close: c,
      volume: 1000 + (rng() * 5000 | 0),
    });
  }
  return out;
}

function parseIndicatorList() {
  const src = readFileSync(INDICATOR_BARREL, "utf8");
  const names = [];
  const re = /export\s+\{([^}]+)\}\s+from\s+"\.\/[a-z-]+"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    // Strip line comments inside the block
    const body = m[1].replace(/\/\/[^\n]*/g, "");
    const entries = body.split(",").map((s) => s.trim()).filter(Boolean);
    for (const e of entries) {
      const name = e.split(/\s+as\s+/)[0].trim();
      if (name && /^[a-zA-Z_$][\w$]*$/.test(name)) names.push(name);
    }
  }
  return [...new Set(names)];
}

// Minimal sensible options for indicators that require a second argument.
// Anything NOT listed gets `undefined` — expected to work with candles only.
const DEFAULT_OPTS = {
  sma: { period: 20 }, ema: { period: 20 }, wma: { period: 20 }, vwma: { period: 20 },
  volumeMa: { period: 20 }, highestLowest: { period: 20 }, superSmoother: { period: 20 },
  anchoredVwap: { anchorTime: Date.UTC(2024, 0, 1) },
};

// Indicators that take TWO series args. For these we synthesize a benchmark.
const NEEDS_BENCHMARK = new Set([
  "benchmarkRS", "calculateRSRating", "isOutperforming", "rankByRS", "topByRS",
  "bottomByRS", "filterByRSPercentile", "compareRS",
]);
// regimeTransitionMatrix takes a regime-labeled series, not candles.
const SPECIAL = new Set(["regimeTransitionMatrix", "filterStocksByAtr"]);

// --- child-mode: run one indicator and print JSON ---

async function runOne(name) {
  const tc = await import(pathToFileURL(DIST_ENTRY).href);
  const fn = tc[name];
  if (typeof fn !== "function") {
    console.log(JSON.stringify({ name, status: "not-a-function", valueType: typeof fn }));
    return;
  }
  const candles = makeCandles();
  if (SPECIAL.has(name)) {
    console.log(JSON.stringify({ name, status: "skipped", reason: "requires specialized input (not candles)" }));
    return;
  }
  let args;
  if (NEEDS_BENCHMARK.has(name)) {
    const bench = makeCandles();
    // Most RS functions take (target, benchmark[, options]) where both are Series/candles.
    args = [candles, bench];
  } else if (DEFAULT_OPTS[name]) {
    args = [candles, DEFAULT_OPTS[name]];
  } else {
    args = [candles];
  }
  const t0 = performance.now();
  let res;
  try {
    res = fn(...args);
  } catch (err) {
    console.log(JSON.stringify({ name, status: "throw", error: err.message, ms: performance.now() - t0 }));
    return;
  }
  const ms = performance.now() - t0;
  let shape;
  if (res == null) shape = "null/undefined";
  else if (Array.isArray(res)) {
    const definedCount = res.filter((p) => p && p.value !== undefined && p.value !== null).length;
    shape = `Series len=${res.length} defined=${definedCount}`;
  } else if (typeof res === "object") {
    const keys = Object.keys(res);
    const seriesKeys = keys.filter((k) => Array.isArray(res[k]));
    shape = seriesKeys.length
      ? `Obj<${seriesKeys.join(",")}>${seriesKeys[0] ? ` len=${res[seriesKeys[0]].length}` : ""}`
      : `Obj{${keys.slice(0, 4).join(",")}${keys.length > 4 ? ",..." : ""}}`;
  } else shape = typeof res;
  console.log(JSON.stringify({ name, status: "ok", shape, ms: Math.round(ms) }));
}

// --- parent-mode: spawn one child per indicator ---

function sweepOne(name, scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, name], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, PER_CALL_TIMEOUT_MS);

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (signal === "SIGKILL") {
        resolve({ name, status: "timeout", ms: PER_CALL_TIMEOUT_MS });
        return;
      }
      const line = out.trim().split("\n").pop() ?? "";
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ name, status: "crash", error: err.trim().split("\n").slice(-3).join(" | "), exitCode: code });
      }
    });
  });
}

async function main() {
  const arg = process.argv[2];
  if (arg) {
    await runOne(arg);
    return;
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const names = parseIndicatorList();
  console.log(`Parsed ${names.length} value exports from indicators/index.ts`);

  const results = [];
  let i = 0;
  for (const name of names) {
    i++;
    process.stdout.write(`\r[${i}/${names.length}] ${name.padEnd(40)}`);
    const r = await sweepOne(name, scriptPath);
    results.push(r);
  }
  process.stdout.write("\r".padEnd(80) + "\r");

  writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

  const by = { ok: 0, throw: 0, timeout: 0, crash: 0, "not-a-function": 0, other: 0 };
  for (const r of results) by[r.status] = (by[r.status] ?? 0) + 1;
  console.log(`\nResults: ${JSON.stringify(by)}`);
  console.log(`Report: ${REPORT_PATH}`);

  const fails = results.filter((r) => r.status !== "ok");
  if (fails.length) {
    console.log(`\n${fails.length} issue(s):`);
    for (const r of fails) {
      const detail = r.error ? ` — ${r.error}` : r.ms ? ` (${r.ms}ms)` : "";
      console.log(`  ${r.status.padEnd(14)} ${r.name}${detail}`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
