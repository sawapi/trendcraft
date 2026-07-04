// @vitest-environment node
/**
 * Doc-snippet harness (Tier 1.5 — type-check).
 *
 * Compiles EVERY fenced `ts`/`typescript` block in the package docs with the
 * real TypeScript compiler against the in-repo source, in ONE virtual program:
 *
 *   Layer A — every fence must type-check. Catches wrong option-object keys,
 *   wrong return-field access, wrong signatures, out-of-scope variables, and
 *   nullability the docs ignore — the classes both the import check (Tier 1)
 *   and the executed subset (Tier 2) are blind to.
 *
 *   Layer B — every fence that re-declares an interface / object type alias
 *   whose name is also exported from the main entry is mirrored against the
 *   real type: the key sets must match exactly and the two shapes must be
 *   mutually assignable. Catches reference-doc shape drift (e.g. a doc block
 *   listing stale field names for a result type).
 *
 * Design notes:
 *   - Reference-style fences (API.md) intentionally omit imports; free
 *     identifiers that are real package exports are auto-imported with their
 *     REAL types, so calls and member access are still fully checked. Fences
 *     that DO show imports have those imports checked as written.
 *   - Free identifiers that are doc context variables ("candles", "wf", …) are
 *     declared from the typed FIXTURES dictionary below. A new context variable
 *     in the docs fails the suite until it is added here (or the doc declares
 *     it) — that is deliberate: the dictionary is the allowlist.
 *   - Signature-template arguments (`rsiBelow(threshold = 30)`) are rewritten
 *     to their default value so the documented default is checked against the
 *     real parameter type.
 *   - `<!-- doctest-notypecheck: reason -->` on the line before a fence opts it
 *     out (for pseudo-syntax summaries). Opt-outs and auto-skips are counted
 *     and bounded by constants below so silent-skip creep is visible.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");
const SRC = path.join(pkgRoot, "src");

// Same doc surface as the Tier-1 import check.
const DOC_FILES = [
  "docs/COOKBOOK.md",
  "docs/GUIDE.md",
  "docs/API.md",
  "docs/GUIDE.ja.md",
  "docs/API.ja.md",
  "README.md",
  "README.ja.md",
];

// Published specifier → absolute in-repo source entry (mirrors Tier 1/2 maps).
const ENTRIES: Record<string, string> = {
  trendcraft: path.join(SRC, "index.ts"),
  "trendcraft/screening": path.join(SRC, "screening/index.ts"),
  "trendcraft/incremental": path.join(SRC, "indicators/incremental/index.ts"),
  "trendcraft/safe": path.join(SRC, "indicators/safe.ts"),
  "trendcraft/manifest": path.join(SRC, "manifest/index.ts"),
};
const AUTO_IMPORT_ORDER = Object.keys(ENTRIES);
const MIRROR_ENTRY = "trendcraft";

// If a fence auto-skips beyond these bounds, a doc change introduced a new
// non-compilable fence shape — either fix the fence or raise the bound
// deliberately (with a review of why the fence cannot compile).
const MAX_AUTO_SKIPPED = 2; // bare `...` placeholder fragments
const MAX_OPTED_OUT = 0; // explicit <!-- doctest-notypecheck --> markers

// ---------------------------------------------------------------- fixtures
// Typed declarations for the docs' free context variables. Types are REAL
// package types (via `import("<abs source>")`), so member access and argument
// passing on fixtures is still verified. `{core}` / `{incr}` expand to entries.
const N = 'import("{core}").NormalizedCandle';
const C = 'import("{core}").Candle';
const T = (name: string) => `import("{core}").${name}`;
const F = (fn: string) => `typeof import("{core}").${fn}`;
const FIXTURES: Record<string, string> = {
  // candle arrays (normalized)
  ...Object.fromEntries(
    [
      "candles",
      "dailyCandles",
      "weeklyCandles",
      "hourlyCandles",
      "intradayCandles",
      "historicalCandles",
      "stockCandles",
      "sp500Candles",
      "benchmarkCandles",
      "nikkei225Candles",
      "aaplCandles",
      "googlCandles",
      "msftCandles",
      "toyotaCandles",
      "sonyCandles",
      "nintendoCandles",
      "candlesGOOG",
      "candlesMSFT",
      "candlesSPY",
      "candlesQQQ",
      "stream",
    ].map((n) => [n, `${N}[]`]),
  ),
  // raw (pre-normalization) candle arrays
  ...Object.fromEntries(
    [
      "rawCandles",
      "rawDailyCandles",
      "aaplRaw",
      "msftRaw",
      "googRaw",
      "amznRaw",
      "toyotaRaw",
      "sonyRaw",
      "softbankRaw",
    ].map((n) => [n, `${C}[]`]),
  ),
  stockData: `Record<string, ${C}[]>`,
  // single bars
  ...Object.fromEntries(
    ["candle", "bar", "formingBar", "formedCandle", "partialCandle"].map((n) => [n, N]),
  ),
  // numeric arrays
  ...Object.fromEntries(
    [
      "dailyReturns",
      "returnsA",
      "returnsB",
      "spyReturns",
      "tltReturns",
      "gldReturns",
      "stockReturns",
      "pos1Returns",
      "pos2Returns",
      "residuals",
      "trialSharpes",
    ].map((n) => [n, "number[]"]),
  ),
  // scalar pseudo-params used by signature-catalog fences
  ...Object.fromEntries(
    [
      "period",
      "threshold",
      "adxThreshold",
      "shortPeriod",
      "longPeriod",
      "stdDev",
      "ratio",
      "minConfidence",
      "riskFreeRate",
      "annualizedReturnPercent",
      "maxDrawdownPercent",
      "netProfit",
      "maxDrawdown",
      "atrValue",
      "barTime",
      "currentTime",
      "index",
      "fast",
      "slow",
    ].map((n) => [n, "number"]),
  ),
  name: "string",
  csvString: "string",
  timeframe: T("TimeframeShorthand"),
  requiredTimeframes: `${T("TimeframeShorthand")}[]`,
  entry: T("Condition"),
  exit: T("Condition"),
  entryConditions: `Parameters<${F("combinationSearch")}>[1]`,
  exitConditions: `Parameters<${F("combinationSearch")}>[2]`,
  result: T("BacktestResult"),
  backtestResult: T("BacktestResult"),
  resultA: T("BacktestResult"),
  resultB: T("BacktestResult"),
  resultC: T("BacktestResult"),
  bestResult: T("BacktestResult"),
  wf: T("WalkForwardResult"),
  mcResult: T("MonteCarloResult"),
  awfResult: `Parameters<${F("summarizeAWFResult")}>[0]`,
  awfOptions: `Parameters<${F("generateAWFBoundaries")}>[1]`,
  strategyFactory: T("StrategyFactory"),
  paramRanges: `${T("ParameterRange")}[]`,
  datasets: `Parameters<${F("batchBacktest")}>[0]`,
  symbolsMap: `Map<string, ${N}[]>`,
  ws: "{ on(event: string, handler: (data: any) => void): void }",
  config: T("ScoringConfig"),
  strategyJson: T("StrategyJSON"),
  trace: `Parameters<${F("generateNarrative")}>[0]`,
  myData: `${T("Series")}<number | null>`,
  scoreSeries: `Parameters<${F("createObservationsFromScores")}>[0]`,
  rsiSeries: `${T("Series")}<number | null>`,
  seriesA: `${T("Series")}<number | null>`,
  seriesB: `${T("Series")}<number | null>`,
  shortMA: `${T("Series")}<number | null>`,
  longMA: `${T("Series")}<number | null>`,
  tickStream: `${T("streaming")}.Trade[]`,
  trades: `${T("streaming")}.Trade[]`,
  rsiIndicator: `ReturnType<typeof import("{incr}").createRsi>`,
  entryCondition: `Parameters<typeof import("{core}").streaming.evaluateStreamingCondition>[0]`,
  snapshot: `Parameters<typeof import("{core}").streaming.evaluateStreamingCondition>[1]`,
  pipeline: `{ next(candle: ${N}): Parameters<${F("fromPipelineResult")}>[0] }`,
  manager: `ReturnType<${F("createSignalManager")}>`,
  incomingSignals: `Parameters<ReturnType<${F("createSignalManager")}>["onBar"]>[0]`,
  signal: `Parameters<ReturnType<${F("createSignalManager")}>["onBar"]>[0][number]`,
  myConditionFactory: `(period: number) => ${T("Condition")}`,
  someThrowingFunction: "() => unknown",
  updateChart: "(...args: unknown[]) => void",
  placeOrder: "(...args: unknown[]) => void",
  closeAllPositions: "() => void",
  evaluate: `Parameters<${F("mtfCondition")}>[2]`,
  evaluateFn: `Parameters<${F("mtfCondition")}>[2]`,
  options: T("SignalManagerOptions"),
  comboReturns: "number[][]",
  // external data vendors (the docs' stated payload shapes)
  exchange:
    "{ fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<Array<[number, number, number, number, number, number]>> }",
  alpaca:
    "{ getBars(opts: { symbol: string; timeframe: string; limit?: number }): Promise<Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>> }",
  yahooFinance:
    "{ chart(symbol: string, opts: { period1: string }): Promise<{ quotes: Array<{ date: Date; open: number; high: number; low: number; close: number; volume: number }> }> }",
};
// Fixtures the docs re-assign (none in core docs today).
const MUTABLE_FIXTURES = new Set<string>();
// Placeholder TYPE fixtures (doc narrative types); none needed for core docs.
const TYPE_FIXTURES: Record<string, string> = {};

function substituteFixturePaths(type: string): string {
  return type
    .replaceAll("{core}", ENTRIES.trendcraft)
    .replaceAll("{incr}", ENTRIES["trendcraft/incremental"]);
}

// ---------------------------------------------------------------- fences
type Fence = {
  file: string;
  index: number;
  lang: string;
  mdLine: number; // 1-based line of the first fence body line
  code: string;
  noTypecheck: boolean;
};

const FENCE_OPEN_RE = /^```(ts|typescript)\s*$/;
const NOTYPECHECK_RE = /<!--\s*doctest-notypecheck\b[^>]*-->/;

function extractFences(relFile: string): Fence[] {
  const lines = readFileSync(path.join(pkgRoot, relFile), "utf8").split("\n");
  const out: Fence[] = [];
  let i = 0;
  let idx = 0;
  while (i < lines.length) {
    const m = lines[i].match(FENCE_OPEN_RE);
    if (!m) {
      i++;
      continue;
    }
    const lookback = lines.slice(Math.max(0, i - 3), i).join("\n");
    const noTypecheck = NOTYPECHECK_RE.test(lookback);
    const bodyStart = i + 2;
    const body: string[] = [];
    i++;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
    i++;
    out.push({
      file: relFile,
      index: idx++,
      lang: m[1],
      mdLine: bodyStart,
      code: body.join("\n"),
      noTypecheck,
    });
  }
  return out;
}

// A bare `...`/`…` placeholder (not a spread `...expr`) marks a fragment.
function hasBareEllipsis(code: string): boolean {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  return /\.\.\.(?![A-Za-z_$([{'"`0-9])/.test(stripped) || /…/.test(stripped);
}

// ---------------------------------------------------------- compiler setup
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  strict: true,
  noEmit: true,
  esModuleInterop: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  types: [],
};

// ---------------------------------------------------------- name analysis
/**
 * Collect FILE-scope declared names and referenced identifiers. Only file-scope
 * declarations suppress auto-import/fixtures — a nested function parameter
 * named `candles` must not hide the fixture the top-level statements rely on
 * (references inside the nested scope still resolve to the parameter).
 */
function analyzeNames(sourceFile: ts.SourceFile): {
  declared: Set<string>;
  referenced: Set<string>;
} {
  const declared = new Set<string>();
  const referenced = new Set<string>();
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      const p = node.parent;
      if (!p) return;
      const isDecl =
        ((ts.isVariableDeclaration(p) ||
          ts.isFunctionDeclaration(p) ||
          ts.isClassDeclaration(p) ||
          ts.isInterfaceDeclaration(p) ||
          ts.isTypeAliasDeclaration(p) ||
          ts.isEnumDeclaration(p) ||
          ts.isModuleDeclaration(p) ||
          ts.isParameter(p) ||
          ts.isBindingElement(p) ||
          ts.isImportClause(p) ||
          ts.isNamespaceImport(p) ||
          ts.isImportSpecifier(p) ||
          ts.isTypeParameterDeclaration(p)) &&
          p.name === node) ||
        (ts.isImportSpecifier(p) && p.propertyName === node);
      if (isDecl) {
        let scope: ts.Node | undefined = p.parent;
        while (
          scope &&
          !ts.isSourceFile(scope) &&
          !ts.isFunctionLike(scope) &&
          !ts.isClassLike(scope) &&
          !ts.isInterfaceDeclaration(scope) &&
          !ts.isTypeAliasDeclaration(scope)
        ) {
          scope = scope.parent;
        }
        if (scope && ts.isSourceFile(scope)) declared.add(node.text);
        return;
      }
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === node) ||
        (ts.isQualifiedName(p) && p.right === node) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isPropertySignature(p) && p.name === node) ||
        (ts.isMethodSignature(p) && p.name === node) ||
        (ts.isPropertyDeclaration(p) && p.name === node) ||
        (ts.isMethodDeclaration(p) && p.name === node) ||
        (ts.isGetAccessorDeclaration(p) && p.name === node) ||
        (ts.isSetAccessorDeclaration(p) && p.name === node) ||
        (ts.isBindingElement(p) && p.propertyName === node) ||
        ts.isExportSpecifier(p) ||
        (ts.isEnumMember(p) && p.name === node) ||
        (ts.isLabeledStatement(p) && p.label === node) ||
        (ts.isBreakOrContinueStatement(p) && p.label === node);
      if (!skip) referenced.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { declared, referenced };
}

// -------------------------------------------------- per-fence preprocessing
const SPEC_RE = /(['"])(trendcraft(?:\/[\w-]+)?)\1/g;

function rewriteSpecifiers(code: string): string {
  return code.replace(SPEC_RE, (m, q, spec) => (ENTRIES[spec] ? `${q}${ENTRIES[spec]}${q}` : m));
}

type Prepared = { code: string; sf: ts.SourceFile; wrapped: boolean };

function parse(code: string): ts.SourceFile {
  return ts.createSourceFile("fence.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

/** Syntax errors of a standalone SourceFile (`parseDiagnostics` is not on the public type). */
function parseErrors(sf: ts.SourceFile): readonly ts.Diagnostic[] {
  return (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
}

function prepare(fence: Fence): Prepared {
  let code = rewriteSpecifiers(fence.code);
  let sf = parse(code);

  // Signature-template call arguments: `rsiBelow(threshold = 30)` documents a
  // default. Rewrite `ident = expr` (ident undeclared) to bare `expr` so the
  // documented default is checked against the real parameter type.
  {
    const declaredQuick = new Set<string>();
    const collectDecl = (n: ts.Node): void => {
      if (
        (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n)) &&
        n.name &&
        ts.isIdentifier(n.name)
      ) {
        declaredQuick.add(n.name.text);
      }
      ts.forEachChild(n, collectDecl);
    };
    collectDecl(sf);
    const edits: Array<[number, number]> = [];
    const findTemplateArgs = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        for (const arg of n.arguments) {
          if (
            ts.isBinaryExpression(arg) &&
            arg.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(arg.left) &&
            !declaredQuick.has(arg.left.text)
          ) {
            edits.push([arg.getStart(sf), arg.right.getStart(sf)]);
          }
        }
      }
      ts.forEachChild(n, findTemplateArgs);
    };
    findTemplateArgs(sf);
    if (edits.length) {
      for (const [s, e] of edits.sort((a, b) => b[0] - a[0]))
        code = code.slice(0, s) + code.slice(e);
      sf = parse(code);
    }
  }

  // Declare-ify top-level body-less function declarations (signature docs).
  {
    const inserts: number[] = [];
    for (const st of sf.statements) {
      if (
        ts.isFunctionDeclaration(st) &&
        !st.body &&
        !st.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DeclareKeyword)
      ) {
        inserts.push(st.getStart(sf));
      }
    }
    if (inserts.length) {
      for (const pos of inserts.sort((a, b) => b - a))
        code = `${code.slice(0, pos)}declare ${code.slice(pos)}`;
      sf = parse(code);
    }
  }

  // Bare method-signature fences (`setCandles(candles: CandleData[]): void`)
  // don't parse as statements; they DO parse as interface members. Wrapping
  // still type-checks every referenced parameter/return type.
  let wrapped = false;
  if (parseErrors(sf).length > 0) {
    const wrappedCode = `interface __DocMemberSignatures {\n${code}\n}`;
    const sf2 = parse(wrappedCode);
    if (parseErrors(sf2).length === 0) {
      code = wrappedCode;
      sf = sf2;
      wrapped = true;
    }
  }
  return { code, sf, wrapped };
}

// ---------------------------------------------------------------- assembly
type Checked = {
  fence: Fence;
  vpath: string;
  preambleLines: number;
  layer: "A" | "B";
  mirrorNames?: string[];
};

type Harness = {
  fences: Fence[];
  checked: Checked[];
  autoSkipped: Array<{ fence: Fence; reason: string }>;
  optedOut: Fence[];
  mirrorCount: number;
  findings: string[];
};

let harnessCache: Harness | null = null;

function buildHarness(): Harness {
  if (harnessCache) return harnessCache;

  const virtualFiles = new Map<string, string>();
  const sourceFileCache = new Map<string, ts.SourceFile | undefined>();
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
        sourceFileCache.set(f, sf);
      }
      return sf;
    },
  };

  // Phase 0: parse the entry graph once to learn every export name (values AND
  // types — the runtime import used by Tier 1 cannot see type-only exports).
  const programZero = ts.createProgram({
    rootNames: Object.values(ENTRIES),
    options: compilerOptions,
    host,
  });
  const checker0 = programZero.getTypeChecker();
  const exportsByEntry = new Map<string, Set<string>>();
  for (const [spec, entry] of Object.entries(ENTRIES)) {
    const sf = programZero.getSourceFile(entry);
    const names = new Set<string>();
    const sym = sf && checker0.getSymbolAtLocation(sf);
    if (sym) for (const e of checker0.getExportsOfModule(sym)) names.add(e.getName());
    exportsByEntry.set(spec, names);
  }

  function computePreamble(declared: Set<string>, referenced: Set<string>): string {
    const free = [...referenced].filter((n) => !declared.has(n));
    const bySpec = new Map<string, string[]>();
    for (const n of free) {
      for (const spec of AUTO_IMPORT_ORDER) {
        if (exportsByEntry.get(spec)?.has(n)) {
          if (!bySpec.has(spec)) bySpec.set(spec, []);
          bySpec.get(spec)?.push(n);
          break;
        }
      }
    }
    const parts: string[] = [];
    const imported = new Set<string>();
    for (const [spec, names] of bySpec) {
      parts.push(`import { ${names.join(", ")} } from "${ENTRIES[spec]}";`);
      for (const n of names) imported.add(n);
    }
    const fixtureDecls: string[] = [];
    for (const [fname, ftype] of Object.entries(FIXTURES)) {
      if (!declared.has(fname) && !imported.has(fname) && referenced.has(fname)) {
        const kw = MUTABLE_FIXTURES.has(fname) ? "let" : "const";
        fixtureDecls.push(`declare ${kw} ${fname}: ${substituteFixturePaths(ftype)};`);
      }
    }
    for (const [tname, decl] of Object.entries(TYPE_FIXTURES)) {
      const needed =
        (!declared.has(tname) && !imported.has(tname) && referenced.has(tname)) ||
        fixtureDecls.some((d) => new RegExp(`\\b${tname}\\b`).test(d));
      if (needed && !declared.has(tname) && !imported.has(tname)) parts.push(decl);
    }
    parts.push(...fixtureDecls);
    // Single line: keeps the md-line mapping offset at exactly one line.
    return parts.join(" ");
  }

  function buildVirtual(prep: Prepared): { text: string; preambleLines: number } {
    const { declared, referenced } = analyzeNames(prep.sf);
    const preamble = computePreamble(declared, referenced);
    const hasModuleSyntax =
      /(^|\n)\s*(import|export)\b/.test(prep.code) || preamble.includes("import ");
    const text =
      (preamble ? `${preamble}\n` : "") + prep.code + (hasModuleSyntax ? "" : "\nexport {};");
    return { text, preambleLines: preamble ? 1 : 0 };
  }

  // Layer B: mirror doc-declared interfaces / object type aliases against the
  // real exported type of the same name.
  function buildMirrors(prep: Prepared): { text: string; names: string[] } | null {
    const entryExports = exportsByEntry.get(MIRROR_ENTRY);
    const mirrors: string[] = [];
    for (const st of prep.sf.statements) {
      let mirrorName: string | null = null;
      let generic = false;
      if (ts.isInterfaceDeclaration(st)) {
        mirrorName = st.name.text;
        generic = (st.typeParameters?.length ?? 0) > 0;
      } else if (ts.isTypeAliasDeclaration(st) && ts.isTypeLiteralNode(st.type)) {
        mirrorName = st.name.text;
        generic = (st.typeParameters?.length ?? 0) > 0;
      }
      if (!mirrorName || generic || !entryExports?.has(mirrorName)) continue;
      mirrors.push(mirrorName);
    }
    if (mirrors.length === 0) return null;

    let code = prep.code;
    for (const mirrorName of mirrors) {
      code = code.replace(new RegExp(`\\b${mirrorName}\\b`, "g"), `${mirrorName}__doc`);
    }
    const { declared, referenced } = analyzeNames(prep.sf);
    for (const n of mirrors) referenced.delete(n); // renamed & declared locally
    const preamble = computePreamble(declared, referenced);
    const header =
      (preamble ? `${preamble} ` : "") +
      `import type { ${mirrors.map((n) => `${n} as ${n}__real`).join(", ")} } from "${ENTRIES[MIRROR_ENTRY]}";`;
    const tail: string[] = [];
    for (const n of mirrors) {
      tail.push(
        `type __MissingInDoc_${n} = Exclude<keyof ${n}__real, keyof ${n}__doc>;`,
        `type __ExtraInDoc_${n} = Exclude<keyof ${n}__doc, keyof ${n}__real>;`,
        `const __keys_${n}: [__MissingInDoc_${n} | __ExtraInDoc_${n}] extends [never] ? "ok" : { docIsMissing: __MissingInDoc_${n}[]; docHasExtra: __ExtraInDoc_${n}[] } = "ok";`,
        `declare const __docV_${n}: ${n}__doc; declare const __realV_${n}: ${n}__real;`,
        `const __docAssignable_${n}: ${n}__real = __docV_${n};`,
        `const __realAssignable_${n}: ${n}__doc = __realV_${n};`,
        `void __keys_${n}; void __docAssignable_${n}; void __realAssignable_${n};`,
      );
    }
    return { text: `${header}\n${code}\n${tail.join("\n")}\nexport {};`, names: mirrors };
  }

  const fences = DOC_FILES.flatMap(extractFences);
  const autoSkipped: Array<{ fence: Fence; reason: string }> = [];
  const optedOut: Fence[] = [];
  const checked: Checked[] = [];
  const VDIR = path.join(here, "__doc_typecheck_virtual__");

  for (const fence of fences) {
    if (fence.noTypecheck) {
      optedOut.push(fence);
      continue;
    }
    if (hasBareEllipsis(fence.code)) {
      autoSkipped.push({ fence, reason: "ellipsis-placeholder" });
      continue;
    }
    const prep = prepare(fence);
    const id = `${fence.file.replace(/\W/g, "_")}_${fence.index}`;
    const v = buildVirtual(prep);
    const vpath = path.join(VDIR, `${id}.ts`);
    virtualFiles.set(vpath, v.text);
    checked.push({
      fence,
      vpath,
      preambleLines: v.preambleLines + (prep.wrapped ? 1 : 0),
      layer: "A",
    });

    const mirror = buildMirrors(prep);
    if (mirror) {
      const mpath = path.join(VDIR, `${id}.mirror.ts`);
      virtualFiles.set(mpath, mirror.text);
      checked.push({
        fence,
        vpath: mpath,
        preambleLines: 1,
        layer: "B",
        mirrorNames: mirror.names,
      });
    }
  }

  const program = ts.createProgram({
    rootNames: [...virtualFiles.keys()],
    options: compilerOptions,
    host,
    oldProgram: programZero,
  });

  const findings: string[] = [];
  for (const c of checked) {
    const sf = program.getSourceFile(c.vpath);
    if (!sf) continue;
    const diags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    for (const d of diags) {
      const pos = d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start) : { line: 0 };
      const mdLine = c.fence.mdLine + Math.max(0, pos.line - c.preambleLines);
      const layerTag = c.layer === "B" ? ` [type-mirror: ${c.mirrorNames?.join(", ")}]` : "";
      findings.push(
        `  ${c.fence.file}:${mdLine}${layerTag} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " | ")}`,
      );
    }
  }

  harnessCache = {
    fences,
    checked,
    autoSkipped,
    optedOut,
    mirrorCount: checked.filter((c) => c.layer === "B").length,
    findings,
  };
  return harnessCache;
}

// ---------------------------------------------------------------- tests
const TIMEOUT_MS = 60_000;

describe("doc snippets — type-check (Tier 1.5)", () => {
  it(
    "found ts fences to type-check",
    () => {
      const h = buildHarness();
      expect(h.checked.filter((c) => c.layer === "A").length).toBeGreaterThan(500);
      expect(h.mirrorCount).toBeGreaterThan(50);
    },
    TIMEOUT_MS,
  );

  it(
    "every documented snippet type-checks against the real API",
    () => {
      const h = buildHarness();
      expect(
        h.findings.length,
        `Doc snippet type errors (fix the doc, or opt out with <!-- doctest-notypecheck: reason -->):\n${h.findings.join("\n")}`,
      ).toBe(0);
    },
    TIMEOUT_MS,
  );

  it(
    "auto-skips and opt-outs stay within recorded bounds",
    () => {
      const h = buildHarness();
      const skipReport = h.autoSkipped
        .map((s) => `  ${s.fence.file}#${s.fence.index}: ${s.reason}`)
        .join("\n");
      expect(
        h.autoSkipped.length,
        `Auto-skipped fences exceeded the recorded bound (${MAX_AUTO_SKIPPED}). If the new fragment is intentional, raise MAX_AUTO_SKIPPED deliberately.\n${skipReport}`,
      ).toBeLessThanOrEqual(MAX_AUTO_SKIPPED);
      const optReport = h.optedOut.map((f) => `  ${f.file}#${f.index}`).join("\n");
      expect(
        h.optedOut.length,
        `Opted-out fences exceeded the recorded bound (${MAX_OPTED_OUT}). If the new opt-out is justified, raise MAX_OPTED_OUT deliberately.\n${optReport}`,
      ).toBeLessThanOrEqual(MAX_OPTED_OUT);
    },
    TIMEOUT_MS,
  );
});
