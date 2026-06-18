// @vitest-environment node
/**
 * Doc-snippet harness (Tier 2 — execute).
 *
 * Extracts fenced `ts`/`typescript` code blocks from the package docs and
 * EXECUTES the ones tagged `<!-- doctest-run -->`, asserting they run without
 * throwing. This catches the class of doc bug that type-checking cannot — wrong
 * argument order, silent-null option typos, wrong runtime string keys — which
 * is exactly what the doc audit surfaced (e.g. `openPosition(price, time, …)`,
 * `riskBasedSize({ capital })`, `mtfTimeframes: ["1W"]`).
 *
 * Opt-in by design: only blocks explicitly marked `<!-- doctest-run -->` run,
 * so illustrative / partial snippets (the majority) are never force-executed.
 * Imports of the published package name are rewritten to the in-repo source
 * entry points so the snippets run against the real, current API.
 *
 * Tier 1 (compile-check every block via `tsc`) is tracked separately.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(here, "../../docs");
const tmpDir = path.resolve(here, ".docsnippets-tmp");

// Docs scanned for runnable snippets. Reference-style files (API.md) carry
// mostly partial fragments and are covered by the compile tier instead.
const DOC_FILES = ["COOKBOOK.md", "GUIDE.md"];

// `import ... from "<pkg>"` → in-repo source entry, relative to a temp file at
// `${tmpDir}/<name>.ts` (one level below src/__tests__).
const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [/(["'])trendcraft\/incremental\1/g, '"../../indicators/incremental"'],
  [/(["'])trendcraft\/screening\1/g, '"../../screening"'],
  [/(["'])trendcraft\/safe\1/g, '"../../indicators/safe"'],
  [/(["'])trendcraft\/manifest\1/g, '"../../manifest"'],
  [/(["'])trendcraft\1/g, '"../../index"'],
];

// Real fixtures for the free variables doc snippets assume from context.
const FIXTURE_PREAMBLE = `
const rawCandles = Array.from({ length: 500 }, (_, i) => {
  const base = 100 + Math.sin(i / 9) * 18 + i * 0.05;
  return {
    time: 1_700_000_000_000 + i * 86_400_000,
    open: base,
    high: base + 2.5,
    low: base - 2.5,
    close: base + Math.cos(i / 6),
    volume: 1_000_000 + (i % 13) * 25_000,
  };
});
const rawDailyCandles = rawCandles;
`;

type Snippet = { file: string; index: number; run: boolean; skip: boolean; code: string };

function extractSnippets(file: string): Snippet[] {
  const text = readFileSync(path.join(docsDir, file), "utf8");
  const lines = text.split("\n");
  const out: Snippet[] = [];
  let i = 0;
  let blockIndex = 0;
  while (i < lines.length) {
    const fence = lines[i].match(/^```(ts|typescript)\s*$/);
    if (!fence) {
      i++;
      continue;
    }
    // Look back a few lines for a marker comment.
    const lookback = lines.slice(Math.max(0, i - 3), i).join("\n");
    const run = /<!--\s*doctest-run\s*-->/.test(lookback);
    const skip = /<!--\s*doctest-skip\s*-->/.test(lookback);
    const body: string[] = [];
    i++;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }
    i++; // consume closing fence
    out.push({ file, index: blockIndex++, run, skip, code: body.join("\n") });
  }
  return out;
}

function rewriteImports(code: string): string {
  let out = code;
  for (const [re, repl] of IMPORT_REWRITES) out = out.replace(re, repl);
  return out;
}

const allSnippets = DOC_FILES.filter((f) => existsSync(path.join(docsDir, f))).flatMap(
  extractSnippets,
);
const runnable = allSnippets.filter((s) => s.run);

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
      const moduleSrc = `${FIXTURE_PREAMBLE}\n${rewriteImports(s.code)}\n`;
      const file = path.join(tmpDir, `${s.file.replace(/\W/g, "_")}_${s.index}.ts`);
      writeFileSync(file, moduleSrc, "utf8");
      // Dynamic import executes the module top-to-bottom; vitest transpiles TS.
      await expect(import(/* @vite-ignore */ file)).resolves.toBeDefined();
    });
  }
});
