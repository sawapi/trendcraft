#!/usr/bin/env npx zx
/**
 * analyze.mjs - Automated chart analysis snapshot generator
 *
 * Generates analysis snapshots: 1 weekly chart image + structured text data.
 * Requires: agent-browser, chart-viewer dev server running at localhost:5173
 *
 * Usage:
 *   ./analyze.mjs <csv_file>              # Output to /tmp/analysis/<symbol>/
 *   ./analyze.mjs <csv_file> <output_dir> # Output to specified directory
 *
 * Outputs:
 *   step1-weekly.png  - Weekly chart (5yr, SMA/Ichimoku/RSI)
 *   readings.txt      - Daily indicator time series (20 rows)
 *   signals.txt       - GC/DC history, divergence, BB squeeze
 *   valuation.txt     - PER/PBR/ROE with percentiles (if available)
 *   recent-data.txt   - Last 20 days OHLCV from CSV
 *   status.json       - Chart state metadata
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const csvPath = argv._[0];
if (!csvPath || argv.help) {
  console.log(`Usage: ./analyze.mjs <csv_file> [output_dir]

Examples:
  ./analyze.mjs ../data/7203.T.csv
  ./analyze.mjs ../data/7182.T.csv /tmp/my-analysis`);
  process.exit(csvPath ? 0 : 1);
}

const resolvedCsv = resolve(csvPath);
if (!existsSync(resolvedCsv)) {
  console.error(`Error: File not found: ${resolvedCsv}`);
  process.exit(1);
}

const symbol = basename(csvPath, ".csv");
const outputDir = resolve(argv._[1] ?? `/tmp/analysis/${symbol}`);
mkdirSync(outputDir, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run JS in the browser via agent-browser eval (returns raw string) */
async function browserEval(js) {
  const { stdout } = await $`agent-browser eval ${js}`.quiet();
  return stdout.trim();
}

/** Run JS in the browser, ignore result */
async function chartEval(js) {
  await $`agent-browser eval ${js}`.quiet();
}

/** Save chart snapshot as PNG */
async function saveSnapshot(outfile) {
  const raw = await browserEval("__chart.snapshot()");
  // Strip surrounding quotes and data URL prefix
  const b64 = raw
    .replace(/^"/, "")
    .replace(/"$/, "")
    .replace(/^data:image\/png;base64,/, "");
  writeFileSync(outfile, Buffer.from(b64, "base64"));
}

/** Parse JSON result from browser eval (double-JSON-encoded) */
function parseEvalJson(raw) {
  return JSON.parse(JSON.parse(raw));
}

/** Format rows as aligned text table */
function formatTable(rows) {
  if (!rows.length) return "No data";
  const keys = Object.keys(rows[0]);
  const widths = {};
  for (const k of keys) {
    widths[k] = Math.max(
      k.length,
      ...rows.map((r) => {
        const v = r[k];
        if (v == null) return 1;
        return String(typeof v === "number" ? v.toFixed(v > 1000 ? 0 : 2) : v).length;
      }),
    );
  }
  const header = keys.map((k) => k.padStart(widths[k])).join(" | ");
  const sep = keys.map((k) => "-".repeat(widths[k])).join("-+-");
  const lines = [header, sep];
  for (const row of rows) {
    lines.push(
      keys
        .map((k) => {
          const v = row[k];
          if (v == null) return "-".padStart(widths[k]);
          if (typeof v === "number")
            return (v > 1000 ? v.toFixed(0) : v.toFixed(2)).padStart(widths[k]);
          return String(v).padStart(widths[k]);
        })
        .join(" | "),
    );
  }
  return lines.join("\n");
}

/** Compute derived metrics from time series rows */
function addDerivedMetrics(rows) {
  for (const r of rows) {
    const close = r.Close;
    const sma25 = r["SMA 25"];
    const sma75 = r["SMA 75"];
    const bbU = r["BB Upper"];
    const bbM = r["BB Middle"];
    const bbL = r["BB Lower"];

    // MA deviation %
    if (close != null && sma25 != null) {
      r["SMA25 Dev%"] = Math.round(((close - sma25) / sma25) * 10000) / 100;
    }
    if (close != null && sma75 != null) {
      r["SMA75 Dev%"] = Math.round(((close - sma75) / sma75) * 10000) / 100;
    }
    // BB %B = (close - lower) / (upper - lower)
    if (close != null && bbU != null && bbL != null && bbU !== bbL) {
      r["BB %B"] = Math.round(((close - bbL) / (bbU - bbL)) * 100) / 100;
    }
    // BB Bandwidth % = (upper - lower) / middle * 100
    if (bbU != null && bbL != null && bbM != null && bbM !== 0) {
      r["BB BW%"] = Math.round(((bbU - bbL) / bbM) * 10000) / 100;
    }

    // Remove raw SMA columns (deviation % is more useful)
    r["SMA 25"] = undefined;
    r["SMA 75"] = undefined;
  }
  return rows;
}

/** Extract recent OHLCV data from CSV */
function extractRecentData(csvPath, count = 20) {
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(",");
    if (cols.length < 6) continue;
    rows.push(cols);
  }
  // Sort by date descending
  rows.sort((a, b) => new Date(b[0].replace(/\//g, "-")) - new Date(a[0].replace(/\//g, "-")));

  const recent = rows.slice(0, count);
  const hasFundamentals = recent.some((r) => r[7] && !Number.isNaN(Number.parseFloat(r[7])));

  let header = "Date        | Open    | High    | Low     | Close   | Volume      | Adj Close";
  if (hasFundamentals) header += " | PER    | PBR";
  const sep = "-".repeat(header.length);

  const out = [header, sep];
  for (const r of recent) {
    let line = [
      (r[0] || "").padEnd(11),
      (r[1] || "").padStart(7),
      (r[2] || "").padStart(7),
      (r[3] || "").padStart(7),
      (r[4] || "").padStart(7),
      (r[5] || "").padStart(11),
      (r[6] || "").padStart(9),
    ].join(" | ");
    if (hasFundamentals) {
      line += ` | ${(r[7] || "").padStart(6)} | ${(r[8] || "").padStart(4)}`;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Format signal summary as text */
function formatSignals(data) {
  const lines = [];

  // GC/DC History
  lines.push("=== GC/DC History (SMA 5/25) ===");
  if (data.cross.length === 0) {
    lines.push("  (none detected)");
  } else {
    // Most recent first
    const sorted = [...data.cross].reverse();
    const now = new Date();
    for (const c of sorted) {
      const typeLabel = c.type === "golden" ? "GC" : "DC";
      let detail;
      if (c.daysUntilReverse === null) {
        // Active signal — calculate days since
        const signalDate = new Date(c.date.replace(/\//g, "-"));
        const daysSince = Math.round((now - signalDate) / (1000 * 60 * 60 * 24));
        detail = `(active, ${daysSince} days)`;
      } else {
        const fake = c.isFake ? " (fake)" : "";
        detail = `-> reversed in ${c.daysUntilReverse}d${fake}`;
      }
      lines.push(`  ${c.date}  ${typeLabel}  score:${c.score}  ${detail}`);
    }
  }

  lines.push("");
  lines.push("=== Divergence ===");
  if (data.divergence.length === 0) {
    lines.push("  (none detected)");
  } else {
    const sorted = [...data.divergence].reverse();
    for (const d of sorted) {
      lines.push(
        `  ${d.date}  ${d.type}  ${d.indicator}  price:[${d.priceChange[0]}, ${d.priceChange[1]}]  ind:[${d.indicatorChange[0]}, ${d.indicatorChange[1]}]`,
      );
    }
  }

  lines.push("");
  lines.push("=== BB Squeeze ===");
  if (data.bbSqueeze.length === 0) {
    lines.push("  (none detected)");
  } else {
    const sorted = [...data.bbSqueeze].reverse();
    for (const s of sorted) {
      lines.push(
        `  ${s.date}  bandwidth:${(s.bandwidth * 100).toFixed(1)}%  percentile:${Math.round(s.percentile)}`,
      );
    }
  }

  return lines.join("\n");
}

/** Format fundamental summary as text */
function formatValuation(data) {
  const lines = ["=== Valuation Summary ==="];
  lines.push("        Current  SMA(20)  Percentile  Level");

  for (const key of ["per", "pbr", "roe"]) {
    const entry = data[key];
    if (!entry) continue;
    const label = key.toUpperCase().padStart(5);
    const current = entry.current.toFixed(2).padStart(7);
    const sma = entry.sma20 != null ? entry.sma20.toFixed(2).padStart(7) : "      -";
    const pct = entry.percentile != null ? `${entry.percentile}%`.padStart(10) : "         -";
    const level = entry.level ?? "-";
    lines.push(`  ${label}  ${current}  ${sma}  ${pct}        ${level}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`=== Chart Analysis: ${symbol} ===`);
console.log(`Output: ${outputDir}/`);
console.log();

// --- 1. Open browser ---
echo("[1/8] Opening browser...");
await $`agent-browser open http://localhost:5173/`.quiet();
await sleep(1000);

// --- 2. Load CSV ---
echo("[2/8] Loading data...");
const csvContent = readFileSync(resolvedCsv, "utf-8");
const loadCmd = `__chart.loadCSV(${JSON.stringify(csvContent)}, ${JSON.stringify(symbol)})`;
const loadResult = await browserEval(loadCmd);
echo(`  ${loadResult}`);

// --- 3. Weekly trend snapshot (only image) ---
echo("[3/8] Weekly trend snapshot...");
await chartEval(
  '__chart.setTimeframe("weekly"); __chart.setDisplayYears(5); ' +
    '__chart.setOverlays(["sma25","sma75"]); __chart.setIndicators([]); ' +
    '__chart.setZoom(0,100); "ok"',
);
await saveSnapshot(`${outputDir}/step1-weekly.png`);

// --- 4. Daily + indicators -> time series ---
echo("[4/8] Extracting indicator time series...");
await chartEval(
  '__chart.setTimeframe("daily"); ' +
    '__chart.setOverlays(["bb","sma25","sma75"]); __chart.setIndicators(["rsi","macd","obv","volumeAnomaly"]); ' +
    '__chart.setSignals([]); __chart.setZoom(85,100); "ok"',
);
const tsRaw = await browserEval("JSON.stringify(__chart.timeSeries(20))");
const tsRows = addDerivedMetrics(parseEvalJson(tsRaw));
writeFileSync(`${outputDir}/readings.txt`, formatTable(tsRows));

// --- 5. Signals -> signals.txt ---
echo("[5/8] Extracting signal data...");
await chartEval('__chart.setSignals(["cross","divergence","bbSqueeze"]); "ok"');
const sigRaw = await browserEval("JSON.stringify(__chart.signalSummary())");
const sigData = parseEvalJson(sigRaw);
if (typeof sigData === "object" && sigData !== null) {
  writeFileSync(`${outputDir}/signals.txt`, formatSignals(sigData));
} else {
  echo("  Warning: no signal data returned");
}

// --- 6. Fundamentals -> valuation.txt ---
const hasFundamentals = (
  await browserEval("__chartStore.getState().fundamentals !== null")
).replace(/"/g, "");
if (hasFundamentals === "true") {
  echo("[6/8] Extracting valuation data...");
  await chartEval(
    '__chart.setOverlays([]); __chart.setIndicators(["per","pbr","roe"]); __chart.setSignals([]); __chart.setZoom(0,100); "ok"',
  );
  const valRaw = await browserEval("JSON.stringify(__chart.fundamentalSummary())");
  const valData = parseEvalJson(valRaw);
  if (typeof valData === "object" && valData !== null) {
    writeFileSync(`${outputDir}/valuation.txt`, formatValuation(valData));
  } else {
    echo("  Warning: no fundamental data returned");
  }
} else {
  echo("[6/8] Valuation: Skipped (no PER/PBR data)");
}

// --- 7. Save status JSON ---
echo("[7/8] Saving status & recent data...");
const statusRaw = await browserEval("JSON.stringify(__chart.status())");
const status = parseEvalJson(statusRaw);
status.params = undefined;
writeFileSync(`${outputDir}/status.json`, JSON.stringify(status, null, 2));

// Close browser
await $`agent-browser close`.quiet();

// --- 8. Recent data from CSV ---
echo("[8/8] Extracting recent OHLCV...");
writeFileSync(`${outputDir}/recent-data.txt`, extractRecentData(resolvedCsv));

console.log();
console.log("=== Done ===");
console.log();
const files = await $`ls -1 ${outputDir}/`.quiet();
console.log(files.stdout);
