// @vitest-environment happy-dom
/**
 * Doc-snippet harness (Tier 2 — execute) for @trendcraft/chart.
 *
 * Extracts fenced `ts`/`typescript` code blocks from the package docs and
 * EXECUTES the ones tagged `<!-- doctest-run -->`, asserting they construct a
 * chart and run without throwing. Catches the doc-bug class type-checking
 * cannot — wrong preset keys, wrong option shapes, fictional methods.
 *
 * Opt-in: only `<!-- doctest-run -->` blocks run. Imports of the published
 * package name are rewritten to in-repo source entries so snippets exercise the
 * real, current API. `trendcraft` resolves natively (dev dependency).
 *
 * happy-dom has no canvas 2D context, so we stub one (same pattern as
 * apply-options.test.ts). Common context variables a self-contained recipe
 * relies on (`container`, `candles`, `chart`) are injected only when the
 * snippet does not declare them.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(here, "../../docs");
const tmpDir = path.resolve(here, ".docsnippets-tmp");

const DOC_FILES = ["COOKBOOK.md"];

// `@trendcraft/chart*` → in-repo source, relative to a temp file at
// `${tmpDir}/<name>.ts` (one level below src/__tests__). `trendcraft` is left
// alone — it resolves through the chart package's dev dependency.
const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [/(["'])@trendcraft\/chart\/headless\1/g, '"../../headless"'],
  [/(["'])@trendcraft\/chart\/presets\1/g, '"../../presets"'],
  [/(["'])@trendcraft\/chart\/replay\1/g, '"../../replay"'],
  [/(["'])@trendcraft\/chart\/sparkline\1/g, '"../../sparkline"'],
  [/(["'])@trendcraft\/chart\1/g, '"../../index"'],
];

const CANDLE_FIXTURE = `[
  { time: 1717200000000, open: 100, high: 104, low: 99, close: 103, volume: 1200 },
  { time: 1717286400000, open: 103, high: 106, low: 102, close: 105, volume: 1500 },
  { time: 1717372800000, open: 105, high: 105, low: 101, close: 102, volume: 1100 },
  { time: 1717459200000, open: 102, high: 108, low: 102, close: 107, volume: 1800 },
  { time: 1717545600000, open: 107, high: 110, low: 106, close: 109, volume: 2000 },
]`;

type Snippet = { file: string; index: number; run: boolean; code: string };

function extractSnippets(file: string): Snippet[] {
  const lines = readFileSync(path.join(docsDir, file), "utf8").split("\n");
  const out: Snippet[] = [];
  let i = 0;
  let blockIndex = 0;
  while (i < lines.length) {
    if (!/^```(ts|typescript)\s*$/.test(lines[i])) {
      i++;
      continue;
    }
    const lookback = lines.slice(Math.max(0, i - 3), i).join("\n");
    const run = /<!--\s*doctest-run\s*-->/.test(lookback);
    const body: string[] = [];
    i++;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
    i++;
    out.push({ file, index: blockIndex++, run, code: body.join("\n") });
  }
  return out;
}

function rewriteImports(code: string): string {
  let out = code;
  for (const [re, repl] of IMPORT_REWRITES) out = out.replace(re, repl);
  return out;
}

function declares(code: string, name: string): boolean {
  return new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(code);
}

function assembleModule(code: string): string {
  const rewritten = rewriteImports(code);
  const lines: string[] = [];
  // A sized container the recipes' `getElementById("chart")` can find.
  lines.push(
    `document.body.innerHTML = '<div id="chart" style="width:800px;height:400px"></div>';`,
  );
  if (!declares(rewritten, "container")) {
    lines.push(`const container = document.getElementById("chart") as HTMLElement;`);
  }
  if (!declares(rewritten, "candles")) lines.push(`const candles = ${CANDLE_FIXTURE};`);
  let preamble = lines.join("\n");
  if (!declares(rewritten, "chart")) {
    preamble = `import { createChart as __mkChart } from "../../index";\n${preamble}\nconst chart = __mkChart(container);`;
  }
  return `${preamble}\n${rewritten}\n`;
}

const allSnippets = DOC_FILES.filter((f) => existsSync(path.join(docsDir, f))).flatMap(
  extractSnippets,
);
const runnable = allSnippets.filter((s) => s.run);

beforeAll(() => {
  const noop = () => {};
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("doc snippets — execute (Tier 2)", () => {
  it("found at least one runnable (doctest-run) snippet", () => {
    expect(runnable.length).toBeGreaterThan(0);
  });

  for (const s of runnable) {
    it(`${s.file} #${s.index} runs without throwing`, async () => {
      mkdirSync(tmpDir, { recursive: true });
      const file = path.join(tmpDir, `${s.file.replace(/\W/g, "_")}_${s.index}.ts`);
      writeFileSync(file, assembleModule(s.code), "utf8");
      await expect(import(/* @vite-ignore */ file)).resolves.toBeDefined();
    });
  }
});
