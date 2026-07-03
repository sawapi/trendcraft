// @vitest-environment node
/**
 * JSDoc @example type-check harness for @trendcraft/chart.
 *
 * Sweeps every non-test source file in `src/`, `react/` and `vue/` for JSDoc
 * `@example` blocks and type-checks the extracted code in ONE virtual
 * TypeScript program, so stale examples (wrong signatures, removed helpers,
 * renamed exports) fail CI the same way stale doc fences do in
 * `docs-import-check` / `docs-snippets`.
 *
 * Leniency model — JSDoc examples conventionally omit imports and fixtures:
 *   - Every runtime export / exported type of the chart entries (main,
 *     headless, presets, replay, sparkline) is ambient-declared.
 *   - The exports of the module each example lives in are declared per
 *     example. Examples under `react/` / `vue/` additionally get their
 *     wrapper entry's exports (the wrappers are separate entry points whose
 *     same-named exports must not collide globally, e.g. `TrendChart`).
 *   - Conventional fixtures (`candles`, `chart`, `container`, React/Vue
 *     helpers like `useEffect` / `ref`) are declared with their real types —
 *     see FIXTURE_TYPES below.
 *   - The ellipsis placeholder convention is tolerated: `[1, 2, ...]` /
 *     `{ a, ... }` become a spread of `any`, and a fully-elided call
 *     `fn(...)` is checked as `(fn as any)()`.
 *   - `import ... from "@trendcraft/chart[/sub]"` / `"trendcraft"` statements
 *     are rewritten to in-repo source entries (same mapping as
 *     docs-import-check; `trendcraft` resolves to core SOURCE so the test is
 *     build-order-independent).
 *   - `tsx` examples compile as .tsx with the package's `jsx: react-jsx`;
 *     `vue` (SFC) examples check only their `<script>` block content — the
 *     template needs the Vue compiler and is out of scope here.
 *
 * Suppressed diagnostics (documented noise, not stale-docs signal):
 *   - TS6133/TS6196/TS6198/TS6205 — unused locals; examples assign results
 *     without consuming them.
 *   - TS2451/TS2393 — redeclarations; one example often shows several
 *     alternative snippets reusing the same const name.
 *   - TS7006/TS7031 — implicit-any callback params / binding elements in
 *     illustrative fragments.
 *   - TS2531/TS18047/TS18048 — strict-null elision; examples intentionally
 *     skip null guards.
 *
 * Opt-out: an example whose first code line starts with `// notypecheck` is
 * skipped (for intentionally partial pseudo-code that cannot type-check).
 * The skip count is pinned below so opt-outs stay deliberate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");
const srcRoot = path.join(pkgRoot, "src");
const INDEX = path.join(srcRoot, "index.ts");
const CORE_INDEX = path.resolve(pkgRoot, "../core/src/index.ts");

/** Number of examples deliberately opted out via `// notypecheck`. */
const EXPECTED_SKIPS = 0;

// Directories swept for @example blocks.
const SWEEP_DIRS = [srcRoot, path.join(pkgRoot, "react"), path.join(pkgRoot, "vue")];

// Entries whose exports become ambient globals (first entry wins on clashes).
// react/vue wrapper entries are NOT global — they are injected per example
// for files under react/ / vue/ (both export e.g. `TrendChart`).
const AMBIENT_ENTRIES = [
  INDEX,
  path.join(srcRoot, "headless.ts"),
  path.join(srcRoot, "presets.ts"),
  path.join(srcRoot, "replay.ts"),
  path.join(srcRoot, "sparkline/index.ts"),
];

// `import ... from "<pkg>"` → in-repo source entry (mirrors docs-import-check's
// SOURCE_TO_ENTRY; `trendcraft` maps to core source for build independence).
const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [/(["'])@trendcraft\/chart\/headless\1/g, JSON.stringify(path.join(srcRoot, "headless.ts"))],
  [/(["'])@trendcraft\/chart\/presets\1/g, JSON.stringify(path.join(srcRoot, "presets.ts"))],
  [/(["'])@trendcraft\/chart\/replay\1/g, JSON.stringify(path.join(srcRoot, "replay.ts"))],
  [
    /(["'])@trendcraft\/chart\/sparkline\1/g,
    JSON.stringify(path.join(srcRoot, "sparkline/index.ts")),
  ],
  [
    /(["'])@trendcraft\/chart\/react\/sparkline\1/g,
    JSON.stringify(path.join(pkgRoot, "react/sparkline.ts")),
  ],
  [/(["'])@trendcraft\/chart\/react\1/g, JSON.stringify(path.join(pkgRoot, "react/index.ts"))],
  [
    /(["'])@trendcraft\/chart\/vue\/sparkline\1/g,
    JSON.stringify(path.join(pkgRoot, "vue/sparkline.ts")),
  ],
  [/(["'])@trendcraft\/chart\/vue\1/g, JSON.stringify(path.join(pkgRoot, "vue/index.ts"))],
  [/(["'])@trendcraft\/chart\1/g, JSON.stringify(INDEX)],
  [/(["'])trendcraft\1/g, JSON.stringify(CORE_INDEX)],
];

// Conventional free variables JSDoc examples assume from context.
const T = (t: string) => `import(${JSON.stringify(INDEX)}).${t}`;
const FIXTURE_TYPES: Record<string, string> = {
  // chart data / instances
  candles: `${T("CandleData")}[]`,
  chart: `ReturnType<typeof import(${JSON.stringify(INDEX)}).createChart>`,
  container: "HTMLElement",
  el: "HTMLElement",
  listEl: "HTMLElement",
  cv: "HTMLCanvasElement",
  data: `${T("DataPoint")}[]`,
  values: `${T("DataPoint")}[]`,
  closes: "number[]",
  tickers: "{ id: string; canvas: HTMLCanvasElement; closes: number[] }[]",
  timeScale: `import(${JSON.stringify(path.join(srcRoot, "headless.ts"))}).TimeScale`,
  priceScale: `import(${JSON.stringify(path.join(srcRoot, "headless.ts"))}).PriceScale`,
  // live integration
  source: T("LiveSource"),
  // core-package objects used bare in integration examples
  presets: `typeof import(${JSON.stringify(CORE_INDEX)}).indicatorPresets`,
  indicatorPresets: `typeof import(${JSON.stringify(CORE_INDEX)}).indicatorPresets`,
  entry: `import(${JSON.stringify(CORE_INDEX)}).Condition`,
  exit: `import(${JSON.stringify(CORE_INDEX)}).Condition`,
  // React helpers used bare in wrapper examples
  useEffect: 'typeof import("react").useEffect',
  useState: 'typeof import("react").useState',
  useRef: 'typeof import("react").useRef',
  // Vue helpers used bare in <script setup> examples
  ref: 'typeof import("vue").ref',
  computed: 'typeof import("vue").computed',
  watch: 'typeof import("vue").watch',
  watchEffect: 'typeof import("vue").watchEffect',
};

// Conventional fixture-name PATTERNS, injected per example for identifiers
// the example uses but does not bind (data arrays only — called identifiers
// are excluded).
const FIXTURE_FAMILIES: Array<[RegExp, string]> = [
  [
    /^(?:[a-z_$][\w$]*)?Candles(?:[A-Z0-9][\w$]*)?$|^candles[A-Z0-9][\w$]*$/,
    `${T("CandleData")}[]`,
  ],
  [/^series[A-Z0-9][\w$]*$|^[a-z_$][\w$]*Series$/, `${T("DataPoint")}[]`],
  // multi-chart examples (chart1, chart2, …)
  [/^chart[A-Z0-9][\w$]*$/, `ReturnType<typeof import(${JSON.stringify(INDEX)}).createChart>`],
];

// Names that would collide with DOM/ES globals from the default libs.
const GLOBAL_NAME_SKIP = new Set([
  "Event",
  "Range",
  "Node",
  "Window",
  "Position",
  "History",
  "Selection",
  "Screen",
]);

// Diagnostic codes suppressed as documented noise (see file header).
const SUPPRESSED_CODES = new Set([
  6133,
  6196,
  6198,
  6205, // unused locals/types
  2451,
  2393, // redeclared alternative-variant consts / functions
  7006,
  7031, // implicit-any example callback params / binding elements
  2531,
  18047,
  18048, // strict-null elision
]);

// ---------------------------------------------------------------------------
// 1. Sweep + extraction
// ---------------------------------------------------------------------------

type Example = { file: string; line: number; code: string; skip: boolean; jsx: boolean };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/**
 * Extract `@example` blocks (see the core package's harness for the format
 * contract). Chart addition: fences carry a language — `vue` fences are SFCs,
 * so only their `<script>` block content is kept; everything else (template,
 * prose outside fences) is blanked, preserving line mapping.
 */
function extractExamples(file: string): Example[] {
  const text = fs.readFileSync(file, "utf8");
  const raw: Array<{ line: number; body: string[] }> = [];
  const re = /\/\*\*[\s\S]*?\*\//g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = re.exec(text)) !== null) {
    const startLine = text.slice(0, m.index).split("\n").length; // 1-based
    const lines = m[0].split("\n");
    let cur: { line: number; body: string[] } | null = null;
    const flush = () => {
      if (cur) raw.push(cur);
      cur = null;
    };
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].replace(/\s*\*\/\s*$/, "").replace(/^\s*\/?\*+ ?/, "");
      if (/^@example\b/.test(stripped)) {
        flush();
        cur = { line: startLine + i + 1, body: [] };
        continue;
      }
      if (cur && /^@[a-zA-Z]/.test(stripped)) {
        flush();
        continue;
      }
      if (cur) cur.body.push(stripped);
    }
    flush();
  }
  const out: Example[] = [];
  for (const b of raw) {
    let { line } = b;
    let body = b.body;
    while (body.length && body[0].trim() === "") {
      body = body.slice(1);
      line++;
    }
    while (body.length && body[body.length - 1].trim() === "") body = body.slice(0, -1);
    let jsx = false;
    if (body.some((l) => /^```/.test(l.trim()))) {
      let lang = "";
      let inScript = false;
      body = body.map((l) => {
        const fence = l.trim().match(/^```(\w*)/);
        if (fence) {
          lang = lang === "" ? fence[1] : "";
          inScript = false;
          return "";
        }
        if (lang === "") return ""; // outside any fence
        if (lang === "vue") {
          // keep only <script>…</script> inner lines of the SFC
          if (/^<script[\s>]/.test(l.trim())) {
            inScript = true;
            return "";
          }
          if (/^<\/script>/.test(l.trim())) {
            inScript = false;
            return "";
          }
          return inScript ? l : "";
        }
        if (lang === "tsx") jsx = true;
        return l;
      });
    }
    const code = body.join("\n");
    if (code.trim() === "") continue;
    const firstLine = body.find((l) => l.trim() !== "")?.trim() ?? "";
    out.push({ file, line, code, skip: firstLine.startsWith("// notypecheck"), jsx });
  }
  return out;
}

const allFiles = SWEEP_DIRS.flatMap((d) => walk(d));
const examples = allFiles.flatMap(extractExamples);
const checked = examples.filter((e) => !e.skip);
const skipped = examples.filter((e) => e.skip);

// ---------------------------------------------------------------------------
// 2. Virtual compiler host (shared SourceFile cache across both programs)
// ---------------------------------------------------------------------------

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  esModuleInterop: true,
};

const virtualFiles = new Map<string, string>();
const sourceFileCache = new Map<string, ts.SourceFile>();
const baseHost = ts.createCompilerHost(compilerOptions, true);
const host: ts.CompilerHost = {
  ...baseHost,
  fileExists: (f) => virtualFiles.has(f) || baseHost.fileExists(f),
  readFile: (f) => virtualFiles.get(f) ?? baseHost.readFile(f),
  getSourceFile: (f, lang, onError, shouldCreate) => {
    const v = virtualFiles.get(f);
    if (v !== undefined) {
      let sf = sourceFileCache.get(f);
      if (!sf || sf.text !== v) {
        sf = ts.createSourceFile(f, v, compilerOptions.target ?? ts.ScriptTarget.ES2022, true);
        sourceFileCache.set(f, sf);
      }
      return sf;
    }
    let sf = sourceFileCache.get(f);
    if (!sf) {
      sf = baseHost.getSourceFile(f, lang, onError, shouldCreate);
      if (sf) sourceFileCache.set(f, sf);
    }
    return sf;
  },
};

// ---------------------------------------------------------------------------
// 3. Export enumeration (phase-1 program) + ambient declaration generation
// ---------------------------------------------------------------------------

type ExportInfo = {
  name: string;
  isValue: boolean;
  isType: boolean;
  typeParams: { text: string; names: string } | null;
};

function buildAmbient(): {
  ambientPath: string;
  declared: Set<string>;
  exportsOf: (f: string) => ExportInfo[];
} {
  const hostModules = [...new Set(checked.map((e) => e.file))];
  const wrapperEntries = [
    path.join(pkgRoot, "react/index.ts"),
    path.join(pkgRoot, "react/sparkline.ts"),
    path.join(pkgRoot, "vue/index.ts"),
    path.join(pkgRoot, "vue/sparkline.ts"),
  ];
  const phase1 = ts.createProgram({
    rootNames: [...AMBIENT_ENTRIES, ...wrapperEntries, ...hostModules],
    options: compilerOptions,
    host,
  });
  const checker = phase1.getTypeChecker();

  const exportsCache = new Map<string, ExportInfo[]>();
  function exportsOf(fileAbs: string): ExportInfo[] {
    const cached = exportsCache.get(fileAbs);
    if (cached) return cached;
    const out: ExportInfo[] = [];
    const sf = phase1.getSourceFile(fileAbs);
    const sym = sf ? checker.getSymbolAtLocation(sf) : undefined;
    if (sym) {
      for (const ex of checker.getExportsOfModule(sym)) {
        const name = ex.getName();
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
        let resolved = ex;
        try {
          if (ex.flags & ts.SymbolFlags.Alias) resolved = checker.getAliasedSymbol(ex);
        } catch {
          // keep the alias symbol if resolution fails
        }
        const isValue = (resolved.flags & ts.SymbolFlags.Value) !== 0;
        const isType =
          (resolved.flags &
            (ts.SymbolFlags.Interface |
              ts.SymbolFlags.TypeAlias |
              ts.SymbolFlags.Class |
              ts.SymbolFlags.Enum)) !==
          0;
        // Generic types need their type-parameter list replicated on the alias.
        let typeParams: ExportInfo["typeParams"] = null;
        if (isType) {
          const decl = (resolved.declarations ?? []).find(
            (
              d,
            ): d is ts.DeclarationStatement & {
              typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>;
            } =>
              (d as { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> })
                .typeParameters !== undefined &&
              ((d as { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }).typeParameters
                ?.length ?? 0) > 0,
          );
          if (decl) {
            typeParams = {
              text: decl.typeParameters.map((p) => p.getText()).join(", "),
              names: decl.typeParameters.map((p) => p.name.text).join(", "),
            };
          }
        }
        out.push({ name, isValue, isType, typeParams });
      }
    }
    exportsCache.set(fileAbs, out);
    return out;
  }

  const ambientLines: string[] = [];
  const declared = new Set<string>();
  for (const entry of AMBIENT_ENTRIES) {
    const spec = JSON.stringify(entry);
    for (const { name, isValue, isType, typeParams } of exportsOf(entry)) {
      if (declared.has(name) || GLOBAL_NAME_SKIP.has(name)) continue;
      declared.add(name);
      if (isValue) ambientLines.push(`declare const ${name}: typeof import(${spec}).${name};`);
      if (isType) {
        ambientLines.push(
          typeParams
            ? `type ${name}<${typeParams.text}> = import(${spec}).${name}<${typeParams.names}>;`
            : `type ${name} = import(${spec}).${name};`,
        );
      }
    }
  }
  const fixtureLines = Object.entries(FIXTURE_TYPES)
    .filter(([name]) => !declared.has(name))
    .map(([name, type]) => `declare const ${name}: ${type};`);
  const ambientPath = path.join(srcRoot, "__jsdoc_examples_ambient__.d.ts");
  virtualFiles.set(ambientPath, [...ambientLines, ...fixtureLines].join("\n") + "\n");
  return { ambientPath, declared, exportsOf };
}

// ---------------------------------------------------------------------------
// 4. Virtual example files
// ---------------------------------------------------------------------------

function rewriteImports(code: string): string {
  let out = code;
  for (const [re, repl] of IMPORT_REWRITES) out = out.replace(re, repl);
  return out;
}

/** Tolerate the ellipsis placeholder convention (see core harness). */
function fillEllipsisHoles(code: string): string {
  return code
    .replace(/=>\s*\{\s*\.\.\.\s*\}/g, "=> {}") // elided function body
    .replace(/([A-Za-z_$][\w$]*)\s*\(\s*\.\.\.\s*\)/g, "($1 as any)()")
    .replace(/\.\.\.(?=\s*[,)\]}]|\s*$)/gm, "...(null as any)");
}

/** Names the example itself binds at top level (imports + declarations). */
function boundNames(code: string): Set<string> {
  const names = new Set<string>();
  for (const m of code.matchAll(/import\s+([^;]*?)\s+from/g)) {
    const clause = m[1];
    const brace = clause.match(/\{([^}]*)\}/);
    if (brace) {
      for (const s of brace[1].split(",")) {
        const p = s
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/);
        const local = (p[1] ?? p[0]).trim();
        if (local) names.add(local);
      }
    }
    const star = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (star) names.add(star[1]);
    const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(,|$)/);
    if (def) names.add(def[1]);
  }
  for (const m of code.matchAll(
    /^\s*(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/^\s*(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/gm)) {
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (!p) continue;
      const alias = p.includes(":") ? p.split(":")[1] : p;
      const name = alias.trim().split(/[=\s]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// 5. Diagnostics
// ---------------------------------------------------------------------------

function collectFindings(): { findings: string[] } {
  const { ambientPath, declared, exportsOf } = buildAmbient();

  type Meta = { file: string; line: number; headerLines: number };
  const exampleMeta = new Map<string, Meta>();
  let counter = 0;
  for (const ex of checked) {
    const bound = boundNames(ex.code);
    const header: string[] = [];
    const headerNames = new Set<string>();
    // Own module first, then the wrapper entry for react/ and vue/ examples.
    const contextModules = [ex.file];
    if (ex.file.startsWith(path.join(pkgRoot, "react") + path.sep)) {
      contextModules.push(
        path.join(pkgRoot, "react/index.ts"),
        path.join(pkgRoot, "react/sparkline.ts"),
      );
    } else if (ex.file.startsWith(path.join(pkgRoot, "vue") + path.sep)) {
      contextModules.push(
        path.join(pkgRoot, "vue/index.ts"),
        path.join(pkgRoot, "vue/sparkline.ts"),
      );
    }
    for (const mod of [...new Set(contextModules)]) {
      const spec = JSON.stringify(mod);
      for (const { name, isValue, isType, typeParams } of exportsOf(mod)) {
        if (bound.has(name) || GLOBAL_NAME_SKIP.has(name) || headerNames.has(name)) continue;
        headerNames.add(name);
        if (isValue) header.push(`declare const ${name}: typeof import(${spec}).${name};`);
        if (isType) {
          header.push(
            typeParams
              ? `type ${name}<${typeParams.text}> = import(${spec}).${name}<${typeParams.names}>;`
              : `type ${name} = import(${spec}).${name};`,
          );
        }
      }
    }
    // family-pattern fixtures (data values only — called identifiers excluded)
    const injected = new Set<string>();
    for (const tok of ex.code.matchAll(/[A-Za-z_$][\w$]*/g)) {
      const name = tok[0];
      if (bound.has(name) || declared.has(name) || injected.has(name) || FIXTURE_TYPES[name])
        continue;
      if (new RegExp(`\\b${name}\\s*\\(`).test(ex.code)) continue;
      const fam = FIXTURE_FAMILIES.find(([re]) => re.test(name));
      if (fam) {
        injected.add(name);
        header.push(`declare const ${name}: ${fam[1]};`);
      }
    }
    const headerText = header.length ? `${header.join("\n")}\n` : "";
    const content = `${headerText}${fillEllipsisHoles(rewriteImports(ex.code))}\nexport {};\n`;
    const ext = ex.jsx ? "tsx" : "ts";
    const vpath = path.join(path.dirname(ex.file), `__jsdoc_example_${counter++}__.${ext}`);
    virtualFiles.set(vpath, content);
    exampleMeta.set(vpath, { file: ex.file, line: ex.line, headerLines: header.length });
  }

  const program = ts.createProgram({
    rootNames: [ambientPath, ...exampleMeta.keys()],
    options: compilerOptions,
    host,
  });

  const findings: string[] = [];
  for (const [vpath, meta] of exampleMeta) {
    const sf = program.getSourceFile(vpath);
    if (!sf) continue;
    const diags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    for (const d of diags) {
      if (SUPPRESSED_CODES.has(d.code)) continue;
      const pos =
        d.file && d.start !== undefined ? ts.getLineAndCharacterOfPosition(d.file, d.start) : null;
      const origLine = pos ? meta.line + (pos.line - meta.headerLines) : meta.line;
      const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
      findings.push(`${path.relative(pkgRoot, meta.file)}:${origLine} TS${d.code}: ${msg}`);
    }
  }
  return { findings };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JSDoc @example blocks — type check", () => {
  it("found @example blocks to check", () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  it("notypecheck opt-outs stay deliberate", () => {
    const list = skipped.map((s) => `  ${path.relative(pkgRoot, s.file)}:${s.line}`).join("\n");
    expect(
      skipped.length,
      `Expected exactly ${EXPECTED_SKIPS} '// notypecheck' example(s); found ${skipped.length}:\n${list}\n` +
        "Update EXPECTED_SKIPS if the change is intentional.",
    ).toBe(EXPECTED_SKIPS);
  });

  it("every @example type-checks against the current API", { timeout: 120_000 }, () => {
    const { findings } = collectFindings();
    expect(
      findings.length,
      `Stale JSDoc @example code (${findings.length} diagnostic(s)):\n${findings.map((f) => `  ${f}`).join("\n")}`,
    ).toBe(0);
  });
});
