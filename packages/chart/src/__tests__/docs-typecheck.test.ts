// @vitest-environment node
/**
 * Doc-snippet harness (Tier 1.5 — type-check) for @trendcraft/chart.
 *
 * Compiles EVERY fenced `ts`/`typescript`/`tsx`/`vue` block in the package
 * docs with the real TypeScript compiler against the in-repo source, in ONE
 * virtual program:
 *
 *   Layer A — every fence must type-check. Catches wrong option-object keys,
 *   wrong return-field access, wrong signatures, out-of-scope variables, and
 *   nullability the docs ignore — the classes both the import check (Tier 1)
 *   and the executed subset (Tier 2) are blind to.
 *
 *   Layer B — every fence that re-declares an interface / object type alias
 *   whose name is also exported from the main entry is mirrored against the
 *   real type: key sets must match exactly and the shapes must be mutually
 *   assignable (this is what catches a doc block listing stale field names).
 *
 * `trendcraft` imports resolve to the core package SOURCE (like the Tier-1
 * import check) so the suite stays build-order-independent. `tsx` fences
 * compile with the react-jsx transform; `vue` fences compile their <script>
 * block. See docs-typecheck.test.ts in packages/core for the full design
 * notes (auto-import of reference-doc identifiers, typed fixture dictionary,
 * signature-template rewriting, `<!-- doctest-notypecheck: reason -->`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");
const CORE_SRC = path.resolve(pkgRoot, "../core/src");

// Same doc surface as the Tier-1 import check.
const DOC_FILES = [
  "docs/API.md",
  "docs/COOKBOOK.md",
  "docs/GUIDE.md",
  "docs/LIVE.md",
  "docs/PLUGINS.md",
  "README.md",
];

// Documented specifier → absolute in-repo source entry. `trendcraft` maps to
// the core SOURCE entry for build-order independence (Tier-1 precedent).
const ENTRIES: Record<string, string> = {
  "@trendcraft/chart": path.join(pkgRoot, "src/index.ts"),
  "@trendcraft/chart/headless": path.join(pkgRoot, "src/headless.ts"),
  "@trendcraft/chart/presets": path.join(pkgRoot, "src/presets.ts"),
  "@trendcraft/chart/replay": path.join(pkgRoot, "src/replay.ts"),
  "@trendcraft/chart/sparkline": path.join(pkgRoot, "src/sparkline/index.ts"),
  "@trendcraft/chart/react": path.join(pkgRoot, "react/index.ts"),
  "@trendcraft/chart/react/sparkline": path.join(pkgRoot, "react/sparkline.tsx"),
  "@trendcraft/chart/vue": path.join(pkgRoot, "vue/index.ts"),
  "@trendcraft/chart/vue/sparkline": path.join(pkgRoot, "vue/sparkline.ts"),
  trendcraft: path.join(CORE_SRC, "index.ts"),
};
// Entries searched when auto-importing a reference-doc's free identifiers.
const AUTO_IMPORT_ORDER = [
  "@trendcraft/chart",
  "@trendcraft/chart/headless",
  "@trendcraft/chart/presets",
  "@trendcraft/chart/replay",
  "@trendcraft/chart/sparkline",
  "@trendcraft/chart/react",
  "@trendcraft/chart/vue",
  "trendcraft",
];
const MIRROR_ENTRY = "@trendcraft/chart";

// Bounds for skip-creep visibility — raise deliberately when a doc change
// legitimately adds a new non-compilable fence.
const MAX_AUTO_SKIPPED = 1; // template-only vue fence (no <script> block)
const MAX_OPTED_OUT = 6; // <!-- doctest-notypecheck --> pseudo-syntax fences

// ---------------------------------------------------------------- fixtures
// Typed declarations for the docs' free context variables (see core's
// docs-typecheck.test.ts for rationale). `{chart}`/`{core}`/… expand to the
// absolute source entries above.
const CH = (name: string) => `import("{chart}").${name}`;
const FIXTURES: Record<string, string> = {
  container: "HTMLElement",
  chart: CH("ChartInstance"),
  candles: 'import("{core}").NormalizedCandle[]',
  history: 'import("{core}").NormalizedCandle[]',
  initialBars: 'import("{core}").NormalizedCandle[]',
  bar: 'import("{core}").NormalizedCandle',
  conn: 'ReturnType<typeof import("{chart}").connectIndicators>',
  live: 'ReturnType<typeof import("{core}").createLiveCandle>',
  liveOptions: 'Parameters<typeof import("{core}").createLiveCandle>[0]',
  ws: "{ on(event: string, handler: (data: any) => void): void; close(): void }",
  url: "string",
  source: CH("LiveSource"),
  presets: 'typeof import("{core}").indicatorPresets',
  backtestResult: CH("BacktestResultData"),
  mySeries: `${CH("DataPoint")}<number | null>[]`,
  mySecondarySeries: `${CH("DataPoint")}<number | null>[]`,
  series: `${CH("DataPoint")}<number | null>[]`,
  myIndicatorData: 'Parameters<typeof import("{headless}").introspect>[0]',
  renkoData: `${CH("DataPoint")}<unknown>[]`,
  draw: CH("DrawHelper"),
  render: "(...args: unknown[]) => void",
  initialState: "MyState",
  root: "HTMLElement",
  rowEl: "HTMLElement",
  el: "HTMLElement",
  tickers: 'Array<{ symbol: string; candles: import("{sparkline}").SparklineCandle[] }>',
  showPatterns: "boolean",
  options: CH("ChartOptions"),
  activeIndicators: "Array<{ id: string; params?: Record<string, unknown> }>",
  useEffect: 'typeof import("react").useEffect',
  props: '{ candles: import("{chart}").CandleData[] }',
  ...Object.fromEntries(["nowMs", "index", "price", "x", "y", "w", "h"].map((n) => [n, "number"])),
};
// Fixtures the docs re-assign (reconnect recipes in LIVE.md).
const MUTABLE_FIXTURES = new Set(["conn", "live", "ws"]);
// Placeholder TYPE fixtures for doc narrative types.
const TYPE_FIXTURES: Record<string, string> = {
  MyState: "type MyState = { tick: number };",
  Zone: "type Zone = { price: number };",
};

function substituteFixturePaths(type: string): string {
  return type
    .replaceAll("{chart}", ENTRIES["@trendcraft/chart"])
    .replaceAll("{headless}", ENTRIES["@trendcraft/chart/headless"])
    .replaceAll("{sparkline}", ENTRIES["@trendcraft/chart/sparkline"])
    .replaceAll("{core}", ENTRIES.trendcraft);
}

// ---------------------------------------------------------------- fences
type Fence = {
  file: string;
  index: number;
  lang: string;
  mdLine: number;
  code: string;
  noTypecheck: boolean;
};

const FENCE_OPEN_RE = /^```(tsx?|typescript|vue)\s*$/;
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
  jsx: ts.JsxEmit.ReactJSX,
};

// ---------------------------------------------------------- name analysis
/** See core's docs-typecheck.test.ts — file-scope declarations only. */
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
        (ts.isBreakOrContinueStatement(p) && p.label === node) ||
        (ts.isJsxAttribute(p) && p.name === node);
      if (!skip) referenced.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { declared, referenced };
}

// -------------------------------------------------- per-fence preprocessing
const SPEC_RE = /(['"])(@trendcraft\/chart(?:\/[\w-]+)*|trendcraft(?:\/[\w-]+)?)\1/g;

function rewriteSpecifiers(code: string): string {
  return code.replace(SPEC_RE, (m, q, spec) => (ENTRIES[spec] ? `${q}${ENTRIES[spec]}${q}` : m));
}

function extractVueScript(code: string): string | null {
  const m = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

type Prepared = { code: string; sf: ts.SourceFile; wrapped: boolean; scriptKind: ts.ScriptKind };

function prepare(fence: Fence): Prepared | { skip: string } {
  let code = fence.code;
  if (fence.lang === "vue") {
    const script = extractVueScript(code);
    if (script === null) return { skip: "vue-template-only" };
    code = script;
  }
  code = rewriteSpecifiers(code);

  const scriptKind = fence.lang === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parse = (text: string) =>
    ts.createSourceFile("fence.ts", text, ts.ScriptTarget.ES2022, true, scriptKind);
  // Syntax errors of a standalone SourceFile (`parseDiagnostics` is not public).
  const parseErrors = (sf2: ts.SourceFile): readonly ts.Diagnostic[] =>
    (sf2 as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  let sf = parse(code);

  // Signature-template call arguments: `f(param = 30)` → `f(30)`.
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

  // Bare method-signature fences parse as interface members; wrapping still
  // type-checks every referenced parameter/return type.
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
  return { code, sf, wrapped, scriptKind };
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
          sf = ts.createSourceFile(
            f,
            v,
            compilerOptions.target ?? ts.ScriptTarget.ES2022,
            true,
            f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
          );
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

  // Phase 0: parse the entry graph once to learn every export name (values AND types).
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

  function computePreamble(declared: Set<string>, referenced: Set<string>, lang: string): string {
    const free = [...referenced].filter((n) => !declared.has(n));
    // Vue SFC fences resolve wrapper names (TrendChart, useTrendChart) against
    // the vue entry first; tsx and ts fences prefer the earlier entries.
    let order = AUTO_IMPORT_ORDER;
    if (lang === "vue") {
      order = [
        ...order.filter((s) => s.includes("/vue")),
        ...order.filter((s) => !s.includes("/vue")),
      ];
    }
    const bySpec = new Map<string, string[]>();
    for (const n of free) {
      for (const spec of order) {
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
    return parts.join(" ");
  }

  function buildVirtual(fence: Fence, prep: Prepared): { text: string; preambleLines: number } {
    const { declared, referenced } = analyzeNames(prep.sf);
    const preamble = computePreamble(declared, referenced, fence.lang);
    const hasModuleSyntax =
      /(^|\n)\s*(import|export)\b/.test(prep.code) || preamble.includes("import ");
    const text =
      (preamble ? `${preamble}\n` : "") + prep.code + (hasModuleSyntax ? "" : "\nexport {};");
    return { text, preambleLines: preamble ? 1 : 0 };
  }

  function buildMirrors(fence: Fence, prep: Prepared): { text: string; names: string[] } | null {
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
    for (const n of mirrors) referenced.delete(n);
    const preamble = computePreamble(declared, referenced, fence.lang);
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
    if ("skip" in prep) {
      autoSkipped.push({ fence, reason: prep.skip });
      continue;
    }
    const id = `${fence.file.replace(/\W/g, "_")}_${fence.index}`;
    const ext = fence.lang === "tsx" ? ".tsx" : ".ts";
    const v = buildVirtual(fence, prep);
    const vpath = path.join(VDIR, `${id}${ext}`);
    virtualFiles.set(vpath, v.text);
    checked.push({
      fence,
      vpath,
      preambleLines: v.preambleLines + (prep.wrapped ? 1 : 0),
      layer: "A",
    });

    const mirror = buildMirrors(fence, prep);
    if (mirror) {
      const mpath = path.join(VDIR, `${id}.mirror${ext}`);
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
    checked,
    autoSkipped,
    optedOut,
    mirrorCount: checked.filter((c) => c.layer === "B").length,
    findings,
  };
  return harnessCache;
}

// ---------------------------------------------------------------- tests
// The harness parses the whole chart AND core source graphs; give it the same
// headroom as the Tier-1 import check.
const TIMEOUT_MS = 60_000;

describe("doc snippets — type-check (Tier 1.5)", () => {
  it(
    "found ts/tsx/vue fences to type-check",
    () => {
      const h = buildHarness();
      expect(h.checked.filter((c) => c.layer === "A").length).toBeGreaterThan(80);
      expect(h.mirrorCount).toBeGreaterThan(2);
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
