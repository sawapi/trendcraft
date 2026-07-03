// @vitest-environment node
/**
 * Contract-wiring guard: every declared `*Options` key must be read somewhere.
 *
 * Motivation: an audit found options keys that were DECLARED (typed, documented,
 * accepted by the compiler) but never WIRED — `GarchOptions.p` / `.q` and
 * `SeriesToCandlesOptions.fillMode` were silently ignored by the
 * implementations. This test makes that class of bug fail loudly:
 *
 * For every exported `interface`/`type` whose name ends in `Options` under
 * src/ (tests excluded), it extracts the literal property keys via the
 * TypeScript AST, then asserts each key's identifier appears in RUNTIME code
 * (type declarations, type annotations, imports/exports and comments are all
 * excluded from the usage corpus) of the modules that consume the type:
 *
 *   - the declaring module,
 *   - every module that references the type name,
 *   - plus modules the options object is forwarded to whole (e.g. garch()
 *     passes its whole options object to annualizationFactor() — the callee's
 *     module joins the corpus instead of the type being skipped, so locally
 *     declared keys still have to be consumed somewhere reachable).
 *
 * This is a word-level heuristic: it proves the key participates in runtime
 * code near the type, not that it is read from this exact object. That is
 * precisely enough to catch the observed bug class — a key that appears
 * NOWHERE outside its declaration — with near-zero false negatives (see the
 * synthetic self-tests at the bottom, which re-create the garch-style bug and
 * assert the analyzer flags it).
 *
 * Notes on the corpus rules:
 *   - Intersections contribute only their literal members; referenced parts
 *     (e.g. the AnnualizationOptions half of GarchOptions) are validated at
 *     their own declaration site.
 *   - Union-typed aliases have no literal members of their own and are skipped.
 *   - Inherited interface members are validated at the base declaration.
 *   - String literals count as usage (covers `options["key"]` bracket access
 *     and schema/registry key tables).
 *   - Rest-destructuring an Options-typed binding (`const { a, ...rest } = o`)
 *     marks the type opaque (remaining keys unverifiable without dataflow).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(here, ".."); // packages/core/src

// ---------------------------------------------------------------------------
// Allowlist — keys that are declared but intentionally not consumed in core
// src, or not verifiable by this heuristic. EVERY entry needs a justification;
// an entry that is actually a latent bug must be fixed in runtime code and
// removed from here, not parked forever.
// ---------------------------------------------------------------------------
const ALLOWLIST: Record<string, string[]> = {
  // LATENT BUG (flagged 2026-07): parseFundamentals() takes an already-decoded
  // string, so `encoding` ("default: utf-8") is never read. Wire it up (accept
  // a Buffer) or remove the key.
  ParseFundamentalsOptions: ["encoding"],
  // LATENT BUG (flagged 2026-07): documented as "softmax temperature for
  // inference (default: 1.0)" but trainCandleFormer() never reads it and does
  // not propagate it into the trained model/config; inference uses predict()'s
  // own parameter. Setting it in train options silently does nothing.
  CandleFormerTrainOptions: ["temperature"],
  // LATENT BUG (flagged 2026-07): documented "(default: 10)" but runScreening
  // is fully synchronous and never reads `concurrency`. Remove or implement.
  ScreeningOptions: ["concurrency"],
  // LATENT BUG (flagged 2026-07): highestLowest() always reads candle
  // high/low; `source?: "high" | "low" | "close"` is never consulted, so
  // callers asking for close-based extremes silently get high/low behavior.
  HighestLowestOptions: ["source"],
  // LATENT BUG (flagged 2026-07): documented "(default: 10)" but
  // robustness/full.ts never reads `perturbationSamples` (unlike its sibling
  // perturbationPercent, which is wired). Remove or implement.
  RobustnessOptions: ["perturbationSamples"],
  // Known-dead, documented in source: "Unused — reserved for future use;
  // riskParityAllocation does not read this option". Kept for API compat.
  RiskParityOptions: ["riskFreeRate"],
  // Known-dead, documented in source: `@deprecated Was never wired into the
  // engine. Use tradeOptions.sizing`. Kept for backward compatibility.
  PortfolioBacktestOptions: ["positionSizing"],
  // Heuristic gap, key IS consumed: incremental indicators accept
  // structurally-identical inline `{ warmUp?: NormalizedCandle[]; … }` params
  // without ever referencing the WarmUpOptions name (e.g.
  // indicators/incremental/momentum/dmi.ts reads warmUpOptions.warmUp), so
  // the name-based consumer search cannot see the usage.
  WarmUpOptions: ["warmUp"],
};

// ---------------------------------------------------------------------------
// AST analysis
// ---------------------------------------------------------------------------

type OptionTypeDecl = {
  name: string;
  file: string;
  props: string[];
  /**
   * Other *Options type names referenced inside this declaration (intersection
   * parts, heritage clauses, property types). Used to propagate consumers:
   * code that handles `RiskBasedSizingOptions` (= PositionSizingBaseOptions &
   * {…}) consumes the base's keys without ever naming the base type.
   */
  refs: string[];
};

type FileAnalysis = {
  file: string;
  /** Every identifier anywhere in the file (consumer detection). */
  allIdents: Set<string>;
  /** Identifiers + string-literal texts in runtime positions only. */
  usage: Set<string>;
  /** Exported *Options declarations found in this file. */
  optionTypes: OptionTypeDecl[];
  /** Options type name -> absolute files its whole value is forwarded to. */
  forwardTargets: Map<string, Set<string>>;
  /** Options type names rest-destructured (unverifiable remaining keys). */
  opaqueTypes: Set<string>;
};

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "__benchmarks__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function hasExportModifier(node: ts.HasModifiers): boolean {
  return ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function propName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

/** Collect literal property keys of a type node (intersections included). */
function literalProps(type: ts.TypeNode, out: string[]): void {
  if (ts.isParenthesizedTypeNode(type)) {
    literalProps(type.type, out);
  } else if (ts.isIntersectionTypeNode(type)) {
    for (const part of type.types) literalProps(part, out);
  } else if (ts.isTypeLiteralNode(type)) {
    for (const member of type.members) {
      if ((ts.isPropertySignature(member) || ts.isMethodSignature(member)) && member.name) {
        const n = propName(member.name);
        if (n) out.push(n);
      }
    }
  }
  // Unions, mapped types, references (incl. Omit<…>) contribute nothing here —
  // referenced shapes are validated at their own declaration sites.
}

/** All TypeReference names ending in "Options" inside a type annotation. */
function optionsRefsInAnnotation(type: ts.TypeNode, out: Set<string>): void {
  const visit = (t: ts.Node): void => {
    if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
      if (t.typeName.text.endsWith("Options")) out.add(t.typeName.text);
    }
    t.forEachChild(visit);
  };
  visit(type);
}

/** Resolve a relative import specifier to an absolute .ts file, if possible. */
function resolveRelativeImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

type ImportResolver = (fromFile: string, spec: string) => string | null;

function analyzeSource(
  fileName: string,
  text: string,
  resolveImport: ImportResolver = resolveRelativeImport,
): FileAnalysis {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);

  const allIdents = new Set<string>();
  const usage = new Set<string>();
  const optionTypes: OptionTypeDecl[] = [];
  /** local import binding -> resolved absolute file. */
  const importSources = new Map<string, string>();
  /** binding name -> Options type names in its annotation. */
  const annotated = new Map<string, Set<string>>();
  /** binding names whose whole value escapes into a call, keyed by callee expr. */
  const escapes: Array<{ binding: string; callee: ts.Expression }> = [];
  const opaqueTypes = new Set<string>();
  /** identifiers rest-destructured later (`const { a, ...rest } = options`). */
  const restDestructured = new Set<string>();

  // Pass 1: every identifier (consumer detection) + imports.
  const collectAll = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) allIdents.add(node.text);
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = resolveImport(fileName, node.moduleSpecifier.text);
      if (resolved && node.importClause) {
        const { name, namedBindings } = node.importClause;
        if (name) importSources.set(name.text, resolved);
        if (namedBindings) {
          if (ts.isNamespaceImport(namedBindings)) {
            importSources.set(namedBindings.name.text, resolved);
          } else {
            for (const spec of namedBindings.elements) {
              importSources.set(spec.name.text, resolved);
            }
          }
        }
      }
    }
    node.forEachChild(collectAll);
  };
  collectAll(sf);

  // Record an Options-typed binding: plain identifier -> annotated map;
  // rest-destructured pattern -> the type becomes opaque.
  const recordBinding = (name: ts.BindingName, type: ts.TypeNode | undefined): void => {
    if (!type) return;
    const refs = new Set<string>();
    optionsRefsInAnnotation(type, refs);
    if (refs.size === 0) return;
    if (ts.isIdentifier(name)) {
      const set = annotated.get(name.text) ?? new Set<string>();
      for (const r of refs) set.add(r);
      annotated.set(name.text, set);
    } else if (ts.isObjectBindingPattern(name)) {
      if (name.elements.some((el) => el.dotDotDotToken)) {
        for (const r of refs) opaqueTypes.add(r);
      }
    }
  };

  // Record whole-value escapes of an identifier into a call/new expression:
  // bare argument, spread argument, object-literal spread / property value.
  const recordEscapes = (call: ts.CallExpression | ts.NewExpression): void => {
    const args = call.arguments ?? [];
    // Unwrap common non-transforming wrappers so `helper(options ?? {})`,
    // `helper((options))` and `helper(options as Foo)` still count as
    // whole-value escapes of `options`.
    const note = (expr: ts.Expression): void => {
      if (ts.isIdentifier(expr)) {
        escapes.push({ binding: expr.text, callee: call.expression });
      } else if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) {
        note(expr.expression);
      } else if (
        ts.isBinaryExpression(expr) &&
        (expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          expr.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        note(expr.left);
        note(expr.right);
      } else if (ts.isConditionalExpression(expr)) {
        note(expr.whenTrue);
        note(expr.whenFalse);
      } else if (ts.isSpreadElement(expr)) {
        note(expr.expression);
      } else if (ts.isObjectLiteralExpression(expr)) {
        for (const prop of expr.properties) {
          if (ts.isSpreadAssignment(prop)) note(prop.expression);
          if (ts.isPropertyAssignment(prop)) note(prop.initializer);
          if (ts.isShorthandPropertyAssignment(prop)) {
            escapes.push({ binding: prop.name.text, callee: call.expression });
          }
        }
      }
    };
    for (const arg of args) note(arg);
  };

  // Pass 2: runtime-usage corpus + declarations + forwarding.
  const collectRuntime = (node: ts.Node): void => {
    // --- declarations of *Options types (excluded from the usage corpus) ---
    if (ts.isInterfaceDeclaration(node)) {
      if (hasExportModifier(node) && node.name.text.endsWith("Options")) {
        const props: string[] = [];
        const refs = new Set<string>();
        for (const member of node.members) {
          if ((ts.isPropertySignature(member) || ts.isMethodSignature(member)) && member.name) {
            const n = propName(member.name);
            if (n) props.push(n);
          }
          if (ts.isPropertySignature(member) && member.type) {
            optionsRefsInAnnotation(member.type, refs);
          }
        }
        for (const heritage of node.heritageClauses ?? []) {
          for (const t of heritage.types) {
            if (ts.isIdentifier(t.expression) && t.expression.text.endsWith("Options")) {
              refs.add(t.expression.text);
            }
          }
        }
        refs.delete(node.name.text);
        optionTypes.push({ name: node.name.text, file: fileName, props, refs: [...refs] });
      }
      return; // do not descend — declaration text is not usage
    }
    if (ts.isTypeAliasDeclaration(node)) {
      if (hasExportModifier(node) && node.name.text.endsWith("Options")) {
        const props: string[] = [];
        literalProps(node.type, props);
        const refs = new Set<string>();
        optionsRefsInAnnotation(node.type, refs);
        refs.delete(node.name.text);
        optionTypes.push({ name: node.name.text, file: fileName, props, refs: [...refs] });
      }
      return;
    }
    // --- non-usage regions ---
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node)
    ) {
      return;
    }
    if (ts.isTypeNode(node)) return; // annotations, `as T`, type args, …

    // --- usage corpus ---
    if (ts.isIdentifier(node)) usage.add(node.text);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      usage.add(node.text);
    }

    // --- Options-typed bindings + forwarding ---
    if (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
      recordBinding(node.name as ts.BindingName, node.type);
      // Un-annotated rest-destructure of an identifier: if the identifier is
      // (or becomes) Options-typed, the type must go opaque — the rest binding
      // can carry any remaining key without its name ever appearing.
      const name = node.name as ts.BindingName;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(name) &&
        name.elements.some((el) => el.dotDotDotToken) &&
        node.initializer !== undefined &&
        ts.isIdentifier(node.initializer)
      ) {
        restDestructured.add(node.initializer.text);
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) recordEscapes(node);

    node.forEachChild(collectRuntime);
  };
  collectRuntime(sf);

  // Join rest-destructures with annotated bindings (post-walk: declaration
  // order between the annotation and the destructure does not matter).
  for (const binding of restDestructured) {
    for (const t of annotated.get(binding) ?? []) opaqueTypes.add(t);
  }

  // Join escapes with annotated bindings -> forward targets per Options type.
  const forwardTargets = new Map<string, Set<string>>();
  for (const { binding, callee } of escapes) {
    const types = annotated.get(binding);
    if (!types) continue;
    // Resolve callee to a module: imported identifier or namespace member.
    let target: string | null = null;
    if (ts.isIdentifier(callee)) {
      target = importSources.get(callee.text) ?? null;
    } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      target = importSources.get(callee.expression.text) ?? null;
    }
    if (!target) continue; // local / unresolvable callee — same-file corpus already applies
    for (const t of types) {
      const set = forwardTargets.get(t) ?? new Set<string>();
      set.add(target);
      forwardTargets.set(t, set);
    }
  }

  return { file: fileName, allIdents, usage, optionTypes, forwardTargets, opaqueTypes };
}

type Violation = { type: string; declaredIn: string; missing: string[] };

/** Cross-file join: per Options type, verify every literal key is used. */
function findViolations(
  analyses: FileAnalysis[],
  allowlist: Record<string, string[]> = ALLOWLIST,
): {
  violations: Violation[];
  optionTypes: OptionTypeDecl[];
  opaque: string[];
} {
  const byFile = new Map(analyses.map((a) => [a.file, a]));
  const optionTypes = analyses.flatMap((a) => a.optionTypes);
  const violations: Violation[] = [];
  const opaque = new Set<string>();

  // Reverse reference graph: base type name -> types whose declarations
  // reference it. Consumers of a derived type also consume the base's keys.
  const referencedBy = new Map<string, Set<string>>();
  for (const decl of optionTypes) {
    for (const ref of decl.refs) {
      const set = referencedBy.get(ref) ?? new Set<string>();
      set.add(decl.name);
      referencedBy.set(ref, set);
    }
  }

  /** The type itself plus every type transitively referencing it. */
  function nameClosure(name: string): Set<string> {
    const closure = new Set<string>([name]);
    const queue = [name];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      for (const dependent of referencedBy.get(current) ?? []) {
        if (!closure.has(dependent)) {
          closure.add(dependent);
          queue.push(dependent);
        }
      }
    }
    return closure;
  }

  for (const decl of optionTypes) {
    if (decl.props.length === 0) continue;

    // Consumers: every file whose identifiers mention the type name — or the
    // name of a type that (transitively) embeds this one in its declaration.
    const closure = nameClosure(decl.name);
    const consumers = analyses.filter((a) => [...closure].some((n) => a.allIdents.has(n)));
    const corpus = new Set<string>();
    let isOpaque = false;
    for (const consumer of consumers) {
      // Opaqueness intentionally does NOT propagate through the closure: a
      // rest-destructure of a derived type should not silence checks on a
      // widely shared base.
      if (consumer.opaqueTypes.has(decl.name)) isOpaque = true;
      for (const word of consumer.usage) corpus.add(word);
      for (const name of closure) {
        for (const target of consumer.forwardTargets.get(name) ?? []) {
          const targetAnalysis = byFile.get(target);
          if (targetAnalysis) for (const word of targetAnalysis.usage) corpus.add(word);
        }
      }
    }
    if (isOpaque) {
      opaque.add(decl.name);
      continue;
    }

    const allowed = new Set(allowlist[decl.name] ?? []);
    const missing = decl.props.filter((p) => !corpus.has(p) && !allowed.has(p));
    if (missing.length > 0) {
      violations.push({ type: decl.name, declaredIn: decl.file, missing });
    }
  }
  return { violations, optionTypes, opaque: [...opaque] };
}

// ---------------------------------------------------------------------------
// Analysis of the real source tree (computed once)
// ---------------------------------------------------------------------------

const analyses = walkTsFiles(SRC_ROOT).map((file) =>
  analyzeSource(file, readFileSync(file, "utf8")),
);
const result = findViolations(analyses, ALLOWLIST);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("*Options contract wiring (declared keys must be read)", () => {
  it("discovers a plausible number of exported Options types (sanity)", () => {
    expect(result.optionTypes.length).toBeGreaterThanOrEqual(150);
  });

  it("regression sentinels: previously-buggy keys are now detected as used", () => {
    // GarchOptions.p/.q and SeriesToCandlesOptions.fillMode were declared but
    // unread until fixed; assert the analyzer sees both the declarations and
    // their (now-existing) usage, so this harness cannot rot into always-pass.
    const garch = result.optionTypes.find((t) => t.name === "GarchOptions");
    expect(garch?.props).toEqual(expect.arrayContaining(["p", "q"]));
    const s2c = result.optionTypes.find((t) => t.name === "SeriesToCandlesOptions");
    expect(s2c?.props).toContain("fillMode");
    expect(result.opaque).not.toContain("GarchOptions");
    expect(result.opaque).not.toContain("SeriesToCandlesOptions");
    const names = result.violations.map((v) => v.type);
    expect(names).not.toContain("GarchOptions");
    expect(names).not.toContain("SeriesToCandlesOptions");
  });

  it("every declared Options key is consumed by runtime code", () => {
    const report = result.violations
      .map((v) => `  ${v.type} (${path.relative(SRC_ROOT, v.declaredIn)}): ${v.missing.join(", ")}`)
      .join("\n");
    expect(
      result.violations,
      `Options key(s) declared but never read anywhere in src/ ` +
        `(dead contract surface — callers can set them, nothing happens). ` +
        `Wire the key up, remove it, or add an allowlist entry WITH justification:\n${report}`,
    ).toEqual([]);
  });

  it("allowlist entries are still needed (no stale entries)", () => {
    // Re-run the join without the allowlist; every allowlisted key must still
    // be genuinely unread. When a key gets wired up (or removed), its
    // allowlist entry must be deleted so it cannot mask a future regression.
    const raw = findViolations(analyses, {});
    const rawMissing = new Map(raw.violations.map((v) => [v.type, new Set(v.missing)]));
    const stale: string[] = [];
    for (const [type, keys] of Object.entries(ALLOWLIST)) {
      for (const key of keys) {
        if (!rawMissing.get(type)?.has(key)) stale.push(`${type}.${key}`);
      }
    }
    expect(
      stale,
      `Stale allowlist entr(ies) — the key is now consumed (or gone); ` +
        `remove from ALLOWLIST:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Synthetic self-tests — prove the analyzer catches the original bug class.
// These re-create the pre-fix shapes in memory and assert they are flagged.
// ---------------------------------------------------------------------------

describe("analyzer self-tests (garch-class bugs are caught)", () => {
  it("flags a declared-but-unread key in the declaring module", () => {
    // Pre-fix SeriesToCandlesOptions.fillMode shape: key declared, never read.
    const src = `
      export type FakeOptions = { used?: number; ghost?: string };
      export function fake(o: FakeOptions = {}): number {
        return o.used ?? 0;
      }
    `;
    const { violations } = findViolations([analyzeSource("/virtual/fake.ts", src)], {});
    expect(violations).toEqual([
      { type: "FakeOptions", declaredIn: "/virtual/fake.ts", missing: ["ghost"] },
    ]);
  });

  it("whole-object forwarding extends the corpus instead of skipping the type", () => {
    // Pre-fix GarchOptions shape: options forwarded whole to a helper in
    // another module (garch() calls annualizationFactor(options)). The forward
    // must NOT excuse locally declared keys — `p` unread anywhere still fails —
    // while a key read only by the forward target (`rate`) passes because the
    // target module joins the usage corpus.
    const helper = `
      export function helper(o: { rate?: number }): number { return o.rate ?? 1; }
    `;
    const main = `
      import { helper } from "./helper";
      export type FwdOptions = { rate?: number; p?: number; tol?: number };
      export function fwd(options?: FwdOptions): number {
        const tol = options?.tol ?? 1e-6;
        return helper(options ?? {}) + tol;
      }
    `;
    const virtualResolver: ImportResolver = (_from, spec) =>
      spec === "./helper" ? "/virtual/helper.ts" : null;
    const analyses = [
      analyzeSource("/virtual/helper.ts", helper, virtualResolver),
      analyzeSource("/virtual/main.ts", main, virtualResolver),
    ];
    const { violations } = findViolations(analyses, {});
    expect(violations).toEqual([
      { type: "FwdOptions", declaredIn: "/virtual/main.ts", missing: ["p"] },
    ]);
  });

  it("rest-destructuring marks a type opaque rather than reporting noise", () => {
    const src = `
      export type RestOptions = { a?: number; b?: number };
      export function rest(options: RestOptions = {}): unknown {
        const { a, ...others } = options;
        return { a, others };
      }
    `;
    const { violations, opaque } = findViolations([analyzeSource("/virtual/rest.ts", src)], {});
    expect(violations).toEqual([]);
    expect(opaque).toContain("RestOptions");
  });
});
