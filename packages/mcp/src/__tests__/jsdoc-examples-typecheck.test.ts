// @vitest-environment node
/**
 * JSDoc @example type-check harness for @trendcraft/mcp.
 *
 * Sweeps every non-test `src/**` source file for JSDoc `@example` blocks and
 * type-checks the extracted code in ONE virtual TypeScript program (compiler
 * API, virtual host, skipLibCheck, noEmit) — same design as the core/chart
 * harnesses; see packages/core/src/__tests__/jsdoc-examples-typecheck.test.ts
 * for the full format contract and leniency model.
 *
 * The mcp source currently carries no @example blocks, so the harness also
 * self-tests its extractor on an inline sample; the moment an @example is
 * added to src/ it gets type-checked with no further wiring.
 *
 * Leniency: the package entry's exports and the module each example lives in
 * are ambient-declared; `candles` is a conventional fixture; imports of
 * "@trendcraft/mcp" / "trendcraft" are rewritten to in-repo sources (core
 * resolves to SOURCE for build-order independence).
 *
 * Suppressed diagnostics (documented noise, not stale-docs signal):
 * TS6133/TS6196/TS6198/TS6205 (unused), TS2451/TS2393 (alternative-variant
 * redeclarations), TS7006/TS7031 (implicit-any example callback params),
 * TS2531/TS18047/TS18048 (strict-null elision).
 *
 * Opt-out: first code line `// notypecheck`; count pinned via EXPECTED_SKIPS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "..");
const INDEX = path.join(srcRoot, "index.ts");
const CORE_INDEX = path.resolve(srcRoot, "../../core/src/index.ts");

/** Number of examples deliberately opted out via `// notypecheck`. */
const EXPECTED_SKIPS = 0;

const AMBIENT_ENTRIES = [INDEX];

const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [/(["'])@trendcraft\/mcp\1/g, JSON.stringify(INDEX)],
  [/(["'])trendcraft\1/g, JSON.stringify(CORE_INDEX)],
];

const T = (t: string) => `import(${JSON.stringify(CORE_INDEX)}).${t}`;
const FIXTURE_TYPES: Record<string, string> = {
  candles: `${T("NormalizedCandle")}[]`,
};

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

/** Extract @example blocks from JSDoc text (see core harness for the contract). */
function extractFromText(file: string, text: string): Example[] {
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

function extractExamples(file: string): Example[] {
  return extractFromText(file, fs.readFileSync(file, "utf8"));
}

const allFiles = walk(srcRoot);
const examples = allFiles.flatMap(extractExamples);
const checked = examples.filter((e) => !e.skip);
const skipped = examples.filter((e) => e.skip);

// ---------------------------------------------------------------------------
// 2. Virtual compiler host
// ---------------------------------------------------------------------------

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
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
// 3. Ambient generation + virtual example files + diagnostics
// ---------------------------------------------------------------------------

type ExportInfo = {
  name: string;
  isValue: boolean;
  isType: boolean;
  typeParams: { text: string; names: string } | null;
};

function rewriteImports(code: string): string {
  let out = code;
  for (const [re, repl] of IMPORT_REWRITES) out = out.replace(re, repl);
  return out;
}

/** Tolerate the ellipsis placeholder convention (see core harness). */
function fillEllipsisHoles(code: string): string {
  return code
    .replace(/=>\s*\{\s*\.\.\.\s*\}/g, "=> {}")
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

function collectFindings(): { findings: string[] } {
  if (checked.length === 0) return { findings: [] };

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

  type Meta = { file: string; line: number; headerLines: number };
  const exampleMeta = new Map<string, Meta>();
  let counter = 0;
  for (const ex of checked) {
    const bound = boundNames(ex.code);
    const spec = JSON.stringify(ex.file);
    const header: string[] = [];
    for (const { name, isValue, isType, typeParams } of exportsOf(ex.file)) {
      if (bound.has(name) || GLOBAL_NAME_SKIP.has(name)) continue;
      if (isValue) header.push(`declare const ${name}: typeof import(${spec}).${name};`);
      if (isType) {
        header.push(
          typeParams
            ? `type ${name}<${typeParams.text}> = import(${spec}).${name}<${typeParams.names}>;`
            : `type ${name} = import(${spec}).${name};`,
        );
      }
    }
    const headerText = header.length ? `${header.join("\n")}\n` : "";
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
      findings.push(`${path.relative(srcRoot, meta.file)}:${origLine} TS${d.code}: ${msg}`);
    }
  }
  return { findings };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JSDoc @example blocks — type check", () => {
  it("extractor self-test (keeps the harness honest at zero examples)", () => {
    const sample = [
      "/**",
      " * Docs.",
      " *",
      " * @example",
      " * ```ts",
      " * const x = 1;",
      " * ```",
      " * @returns nothing",
      " */",
      "export function f(): void {}",
    ].join("\n");
    const found = extractFromText("sample.ts", sample);
    expect(found).toHaveLength(1);
    expect(found[0].code.trim()).toBe("const x = 1;");
    expect(found[0].line).toBe(5);
    expect(found[0].skip).toBe(false);
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
