// @vitest-environment node
/**
 * JSDoc @example type-check harness.
 *
 * Sweeps every non-test `src/**` source file for JSDoc `@example` blocks and
 * type-checks the extracted code in ONE virtual TypeScript program, so stale
 * examples (wrong signatures, removed helpers, renamed exports) fail CI the
 * same way stale doc fences do in `docs-import-check` / `docs-snippets`.
 *
 * Leniency model — JSDoc examples conventionally omit imports and fixtures,
 * so unlike the docs-fence harnesses the whole public surface is put in scope:
 *   - Every runtime export / exported type of the package entries (main,
 *     screening, incremental, safe, manifest, plus the `streaming` module so
 *     its members resolve bare) is ambient-declared.
 *   - Exported namespaces (e.g. `execution`, `streaming`, `safe`) also get a
 *     global `namespace` declaration carrying their exported TYPES, so
 *     qualified type references like `execution.PositionSnapshot` resolve.
 *   - The exports of the module each example lives in are declared per
 *     example (examples often use their own file's non-root-exported helpers).
 *   - Examples under `src/streaming/` additionally get the streaming entry's
 *     exports, shadowing same-named root exports: bare `rsiBelow` in a
 *     streaming example means `streaming.rsiBelow`, not the backtest one.
 *   - Conventional fixtures (`candles`, `stream`, `result`, …) are declared
 *     with their real types — see FIXTURE_TYPES / FIXTURE_FAMILIES below.
 *   - The ellipsis placeholder convention is tolerated: `[1, 2, ...]` /
 *     `{ a, ... }` become a spread of `any`, and a fully-elided call
 *     `fn(...)` is checked as `(fn as any)()` (arity intentionally unchecked).
 *   - `import ... from "trendcraft[/sub]"` statements are rewritten to the
 *     in-repo source entries (same mapping as docs-import-check).
 *
 * Suppressed diagnostics (documented noise, not stale-docs signal):
 *   - TS6133/TS6196/TS6198/TS6205 — unused locals; examples assign results
 *     without consuming them.
 *   - TS2451/TS2393 — redeclarations; one example often shows several
 *     alternative snippets reusing the same `const entry = …` name.
 *   - TS7006/TS7031 — implicit-any callback params / binding elements;
 *     illustrative fragments omit param types real code gets from context.
 *   - TS2531/TS18047/TS18048 — strict-null elision; examples intentionally
 *     skip the null guards on `Series<T | null>` values.
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
const srcRoot = path.resolve(here, "..");
const INDEX = path.join(srcRoot, "index.ts");

/** Number of examples deliberately opted out via `// notypecheck`. */
const EXPECTED_SKIPS = 3;

// Entries whose exports become ambient globals (first entry wins on name
// clashes, so the main entry's meaning of a name is authoritative).
// `streaming` is not a published subpath but its members appear bare in
// streaming examples, so its surface is included last.
const AMBIENT_ENTRIES = [
  INDEX,
  path.join(srcRoot, "screening/index.ts"),
  path.join(srcRoot, "indicators/incremental/index.ts"),
  path.join(srcRoot, "indicators/safe/index.ts"),
  path.join(srcRoot, "manifest/index.ts"),
  path.join(srcRoot, "streaming/index.ts"),
];

// `import ... from "trendcraft[/sub]"` → in-repo source entry (mirrors
// docs-import-check's SUBPATH_TO_SOURCE). Absolute paths keep resolution
// independent of where the virtual example file lives.
const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [
    /(["'])trendcraft\/incremental\1/g,
    JSON.stringify(path.join(srcRoot, "indicators/incremental/index.ts")),
  ],
  [/(["'])trendcraft\/screening\1/g, JSON.stringify(path.join(srcRoot, "screening/index.ts"))],
  [/(["'])trendcraft\/safe\1/g, JSON.stringify(path.join(srcRoot, "indicators/safe/index.ts"))],
  [/(["'])trendcraft\/manifest\1/g, JSON.stringify(path.join(srcRoot, "manifest/index.ts"))],
  [/(["'])trendcraft\1/g, JSON.stringify(INDEX)],
];

// Conventional free variables JSDoc examples assume from context, declared
// with their REAL types so calls against them are genuinely checked. `any` is
// used only for opaque placeholders (resume tokens, "your options here",
// external broker/API pseudo-objects) where no single real type exists.
const T = (t: string) => `import(${JSON.stringify(INDEX)}).${t}`;
const FIXTURE_TYPES: Record<string, string> = {
  // market data
  candles: `${T("NormalizedCandle")}[]`,
  rawCandles: `${T("Candle")}[]`,
  candle: T("NormalizedCandle"),
  currentCandle: T("NormalizedCandle"),
  oneMinCandle: T("NormalizedCandle"),
  stream: `Iterable<${T("NormalizedCandle")}>`,
  series: `${T("Series")}<number | null>`,
  tickStream: "Iterable<{ time: number; price: number; volume: number }>",
  // scalars
  i: "number",
  index: "number",
  endIndex: "number",
  timestamp: "number",
  price: "number",
  currentPrice: "number",
  bestScore: "number",
  // backtest
  result: T("BacktestResult"),
  backtestResult: T("BacktestResult"),
  bestResult: T("BacktestResult"),
  resultA: T("BacktestResult"),
  resultB: T("BacktestResult"),
  resultC: T("BacktestResult"),
  trades: `${T("Trade")}[]`,
  entry: T("Condition"),
  exit: T("Condition"),
  entryConditions: `${T("ConditionDefinition")}[]`,
  exitConditions: `${T("ConditionDefinition")}[]`,
  datasets: `${T("SymbolData")}[]`,
  // optimization
  createStrategy: T("StrategyFactory"),
  parameterRanges: `${T("ParameterRange")}[]`,
  ranges: `${T("ParameterRange")}[]`,
  pathRanges: `${T("PathParameterRange")}[]`,
  gridResult: T("GridSearchResult"),
  walkForwardResult: T("WalkForwardResult"),
  monteCarloResult: T("MonteCarloResult"),
  paretoResult: T("ParetoResult"),
  entries: `${T("OptimizationResultEntry")}[]`,
  objectives: `${T("ParetoObjective")}[]`,
  fronts: "number[][]",
  // numeric arrays
  returns: "number[]",
  returnsMatrix: "number[][]",
  equity: "number[]",
  prices: "number[]",
  weights: "number[]",
  times: "number[]",
  scores: "number[]",
  drawdowns: "number[]",
  residuals: "number[]",
  volatilities: "number[]",
  // HMM
  obs: "number[][]",
  model: T("HmmModel"),
  // strategy JSON / serialization
  strategyJson: T("StrategyJSON"),
  strategyDefinition: T("StrategyDefinition"),
  jsonString: "string",
  csvContent: "string",
  // signals / patterns
  swingHighs: `import(${JSON.stringify(path.join(srcRoot, "signals/patterns/double-pattern-utils.ts"))}).SwingPoint[]`,
  swingLows: `import(${JSON.stringify(path.join(srcRoot, "signals/patterns/double-pattern-utils.ts"))}).SwingPoint[]`,
  upper: T("TrendlineFit"),
  lower: T("TrendlineFit"),
  pair: `{ upper: ${T("TrendlineFit")}; lower: ${T("TrendlineFit")} }`,
  convertedSignals: `${T("TradeSignal")}[]`,
  newSignals: `${T("TradeSignal")}[]`,
  incomingSignals: `${T("TradeSignal")}[]`,
  pipeline: `ReturnType<typeof import(${JSON.stringify(path.join(srcRoot, "streaming/index.ts"))}).createPipeline>`,
  // analysis / misc domain objects
  fundamentals: `${T("FundamentalMetrics")}[]`,
  rollingCorr: `${T("CorrelationPoint")}[]`,
  trace: T("ConditionTrace"),
  criteria: T("ScreeningCriteria"),
  internalPositions: `import(${JSON.stringify(path.join(srcRoot, "execution/index.ts"))}).PositionSnapshot[]`,
  brokerPositions: `import(${JSON.stringify(path.join(srcRoot, "execution/index.ts"))}).PositionSnapshot[]`,
  // streaming
  completedCandle: T("NormalizedCandle"),
  formingCandle: T("NormalizedCandle"),
  trade: "{ time: number; price: number; volume: number }",
  baseShares: "number",
  rsiValue: "number | null",
  smaIndicator: `ReturnType<typeof import(${JSON.stringify(path.join(srcRoot, "indicators/incremental/index.ts"))}).createSma>`,
  emaIndicator: `ReturnType<typeof import(${JSON.stringify(path.join(srcRoot, "indicators/incremental/index.ts"))}).createEma>`,
  rsiIndicator: `ReturnType<typeof import(${JSON.stringify(path.join(srcRoot, "indicators/incremental/index.ts"))}).createRsi>`,
  bbIndicator: `ReturnType<typeof import(${JSON.stringify(path.join(srcRoot, "indicators/incremental/index.ts"))}).createBollingerBands>`,
  // ML
  modelWeights: T("CandleFormerWeights"),
  // misc scalars/strings
  input: "string",
  // incremental resume token (opaque; each createX has its own snapshot type)
  snapshot: "any",
  // generic placeholders (documented leniency: "your X here")
  options: "any",
  config: "any",
  warmUpOptions: "any",
  conn: "any",
  pipelineOptions: "any",
  // external broker/API pseudo-objects in execution examples (structural, so
  // downstream generic inference stays typed)
  api: "{ submitOrder: (order: unknown) => Promise<{ status: string }>; getOrder: (id: string) => Promise<{ status: string }> }",
  broker: "{ getOrder: (id: string) => Promise<{ status: string }> }",
  ws: "any",
  order: "any",
  pendingOrder: "any",
  orderId: "string",
  NetworkError: "new (...args: any[]) => Error",
  // fire-and-forget callback placeholders
  processCandle: `(candle: ${T("NormalizedCandle")}) => void`,
  updateChart: "(...args: any[]) => void",
  placeOrder: "(...args: any[]) => void",
  closeAllPositions: "(...args: any[]) => void",
};

// Conventional fixture-name PATTERNS (open-ended families like sp500Candles /
// candlesSPY / dailyReturns / rsiValues / seriesA), injected per example for
// identifiers the example uses but does not bind itself.
const FIXTURE_FAMILIES: Array<[RegExp, string]> = [
  [
    /^(?:[a-z_$][\w$]*)?Candles(?:[A-Z0-9][\w$]*)?$|^candles[A-Z0-9][\w$]*$/,
    `${T("NormalizedCandle")}[]`,
  ],
  [/^(?:[a-z_$][\w$]*)?Returns$|^returns[A-Z0-9][\w$]*$/, "number[]"],
  [/^(?:[a-z_$][\w$]*)?Prices$|^prices[A-Z0-9][\w$]*$/, "number[]"],
  [/^(?:[a-z_$][\w$]*)?Values$/, "number[]"],
  [/^series[A-Z0-9][\w$]*$|^[a-z_$][\w$]*Series$/, `${T("Series")}<number | null>`],
  // placeholder unified conditions in the condition-DSL examples
  [/^[a-z_$][\w$]*Cond$/, T("UnifiedCondition")],
];

// Names that must never be ambient-declared because they'd collide with
// DOM/ES globals from the default libs.
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
  18048, // strict-null elision on Series values
]);

// ---------------------------------------------------------------------------
// 1. Sweep + extraction
// ---------------------------------------------------------------------------

type Example = { file: string; line: number; code: string; skip: boolean };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/**
 * Extract `@example` blocks from a source file's JSDoc comments. A block's
 * code runs from the line after the `@example` tag (any caption on the tag
 * line is ignored) to the next `@tag` or the end of the comment, with the
 * leading `* ` stripped. When the block contains fenced code, only
 * inside-fence lines are kept (captions/prose outside fences are blanked, not
 * removed, so line numbers keep mapping back to the source file).
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
      // Strip the trailing "*/" first so the closing line leaves no stray "/".
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
    if (body.some((l) => /^```/.test(l.trim()))) {
      let inside = false;
      body = body.map((l) => {
        if (/^```/.test(l.trim())) {
          inside = !inside;
          return "";
        }
        return inside ? l : "";
      });
    }
    const code = body.join("\n");
    if (code.trim() === "") continue;
    const firstLine = body.find((l) => l.trim() !== "")?.trim() ?? "";
    out.push({ file, line, code, skip: firstLine.startsWith("// notypecheck") });
  }
  return out;
}

const allFiles = walk(srcRoot);
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
  strict: true,
  noEmit: true,
  // Rewritten imports point at .ts source files; top-level await in examples
  // is valid under module: ESNext + target: ES2022.
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
  isNamespace: boolean;
  typeParams: { text: string; names: string } | null;
};

function buildAmbient(): {
  ambientPath: string;
  declared: Set<string>;
  exportsOf: (f: string) => ExportInfo[];
} {
  const hostModules = [...new Set(checked.map((e) => e.file))];
  const phase1 = ts.createProgram({
    rootNames: [...AMBIENT_ENTRIES, ...hostModules],
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
        const isNamespace = (resolved.flags & ts.SymbolFlags.Module) !== 0;
        // Generic types need their type-parameter list replicated on the
        // alias: `type Series = import(...).Series` would reject
        // `Series<number>` with TS2314.
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
        out.push({ name, isValue, isType, isNamespace, typeParams });
      }
    }
    exportsCache.set(fileAbs, out);
    return out;
  }

  function typeAliasLine(name: string, spec: string, typeParams: ExportInfo["typeParams"]): string {
    return typeParams
      ? `type ${name}<${typeParams.text}> = import(${spec}).${name}<${typeParams.names}>;`
      : `type ${name} = import(${spec}).${name};`;
  }

  const ambientLines: string[] = [];
  const declared = new Set<string>();
  for (const entry of AMBIENT_ENTRIES) {
    const spec = JSON.stringify(entry);
    for (const { name, isValue, isType, isNamespace, typeParams } of exportsOf(entry)) {
      if (declared.has(name) || GLOBAL_NAME_SKIP.has(name)) continue;
      declared.add(name);
      if (isValue) ambientLines.push(`declare const ${name}: typeof import(${spec}).${name};`);
      if (isType) ambientLines.push(typeAliasLine(name, spec, typeParams));
      if (isNamespace && entry === INDEX) {
        // Re-exported module namespaces (execution, streaming, safe, …): the
        // const above covers VALUE access; a merged global namespace carries
        // the TYPES so `execution.PositionSnapshot` works in type position.
        const nsModule = checker.getSymbolAtLocation(phase1.getSourceFile(entry)!);
        const nsSym = nsModule
          ? checker.getExportsOfModule(nsModule).find((s) => s.getName() === name)
          : undefined;
        const resolvedNs =
          nsSym && nsSym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(nsSym) : nsSym;
        const nsSource = resolvedNs?.declarations?.[0]?.getSourceFile().fileName;
        if (nsSource) {
          const nsSpec = JSON.stringify(nsSource);
          const typeLines = exportsOf(nsSource)
            .filter((e) => e.isType)
            .map((e) => `  export ${typeAliasLine(e.name, nsSpec, e.typeParams)}`);
          if (typeLines.length) ambientLines.push(`declare namespace ${name} {`, ...typeLines, `}`);
        }
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

/**
 * Tolerate the ellipsis placeholder convention: a bare `...` before a closing
 * delimiter becomes a spread of `any` (arrays/objects), and a fully-elided
 * call `fn(...)` is checked as `(fn as any)()` since its arguments are
 * intentionally unspecified.
 */
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
  // destructuring declarations: const { a, b: c } = … / const [a, b] = …
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

type Finding = string;

function collectFindings(): { findings: Finding[]; elapsedMs: number } {
  const started = Date.now();
  const { ambientPath, declared, exportsOf } = buildAmbient();

  type Meta = { file: string; line: number; headerLines: number };
  const exampleMeta = new Map<string, Meta>();
  let counter = 0;
  const streamingEntry = path.join(srcRoot, "streaming/index.ts");
  for (const ex of checked) {
    const bound = boundNames(ex.code);
    const header: string[] = [];
    const headerNames = new Set<string>();
    // Own module first (authoritative for the example), then the streaming
    // subsystem entry for examples living under src/streaming/.
    const contextModules = [ex.file];
    if (
      ex.file.startsWith(path.join(srcRoot, "streaming") + path.sep) &&
      ex.file !== streamingEntry
    ) {
      contextModules.push(streamingEntry);
    }
    for (const mod of contextModules) {
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
    // family-pattern fixtures for identifiers this example uses but doesn't
    // bind. Called identifiers are excluded — families describe data values,
    // so a call like `fooValues(...)` should surface as a real finding.
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
    // `export {}` forces module scope so examples don't clash in global scope.
    const content = `${headerText}${fillEllipsisHoles(rewriteImports(ex.code))}\nexport {};\n`;
    const vpath = path.join(path.dirname(ex.file), `__jsdoc_example_${counter++}__.ts`);
    virtualFiles.set(vpath, content);
    exampleMeta.set(vpath, { file: ex.file, line: ex.line, headerLines: header.length });
  }

  const program = ts.createProgram({
    rootNames: [ambientPath, ...exampleMeta.keys()],
    options: compilerOptions,
    host,
  });

  const findings: Finding[] = [];
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
      findings.push(`${path.relative(srcRoot, meta.file)}:${origLine} TS${d.code}: ${msg}`);
    }
  }
  return { findings, elapsedMs: Date.now() - started };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JSDoc @example blocks — type check", () => {
  it("found @example blocks to check", () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  it("notypecheck opt-outs stay deliberate", () => {
    const list = skipped.map((s) => `  ${path.relative(srcRoot, s.file)}:${s.line}`).join("\n");
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
