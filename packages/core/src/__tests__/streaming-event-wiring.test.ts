// @vitest-environment node
/**
 * Contract-wiring guard for core's streaming event contracts.
 *
 * Same bug class as the chart's ChartEvent guard: an event that is DECLARED
 * (typed, documented, subscribable) but never EMITTED is dead contract
 * surface — subscribers compile fine and wait forever. Core has two clean
 * declared-event contracts in the streaming layer:
 *
 *   1. `LiveCandleEventMap` (streaming/types.ts) — a name -> payload map for
 *      LiveCandle.on(). Both directions are checked: every key must have an
 *      `emit("<key>", …)` site in streaming/, and every literal emit name
 *      must be a declared key.
 *   2. `SessionEvent` (streaming/types.ts) and `PositionEvent`
 *      (streaming/position-manager/types.ts) — discriminated unions returned
 *      from onTrade()/close(). Forward direction only: every declared
 *      `type: "<discriminant>"` variant must be constructed somewhere in
 *      streaming/ runtime code. The reverse guard is intentionally omitted:
 *      `type: "<string>"` object keys are a generic pattern in core (e.g.
 *      indicator preset param descriptors use `type: "number"`), so an
 *      "every constructed literal must be declared" check would be all noise.
 *
 * All extraction is AST-based so string literals in comments/JSDoc examples
 * (`live.on("candleComplete", …)` appears in doc comments) cannot skew either
 * direction.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const STREAMING_ROOT = path.resolve(here, "../streaming");
const STREAMING_TYPES = path.join(STREAMING_ROOT, "types.ts");
const POSITION_TYPES = path.join(STREAMING_ROOT, "position-manager/types.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "__benchmarks__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function parseFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

/** Property-name keys of a type-literal alias (e.g. LiveCandleEventMap). */
function mapKeysOfAlias(sf: ts.SourceFile, aliasName: string): string[] {
  let keys: string[] | null = null;
  sf.forEachChild((node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== aliasName) return;
    if (!ts.isTypeLiteralNode(node.type)) return;
    keys = node.type.members
      .filter(ts.isPropertySignature)
      .map((m) => (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) ? m.name.text : null))
      .filter((n): n is string => n !== null);
  });
  if (!keys) throw new Error(`Type-literal alias ${aliasName} not found in ${sf.fileName}`);
  return keys;
}

/** `type: "<literal>"` discriminants of a discriminated-union alias. */
function discriminantsOfUnion(sf: ts.SourceFile, aliasName: string): string[] {
  let found: string[] | null = null;
  sf.forEachChild((node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== aliasName) return;
    if (!ts.isUnionTypeNode(node.type)) return;
    const out: string[] = [];
    for (const member of node.type.types) {
      if (!ts.isTypeLiteralNode(member)) continue;
      for (const prop of member.members) {
        if (
          ts.isPropertySignature(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === "type" &&
          prop.type &&
          ts.isLiteralTypeNode(prop.type) &&
          ts.isStringLiteral(prop.type.literal)
        ) {
          out.push(prop.type.literal.text);
        }
      }
    }
    found = out;
  });
  if (!found) throw new Error(`Discriminated union ${aliasName} not found in ${sf.fileName}`);
  return found;
}

type Site = { file: string; name: string; line: number };

/** Literal `emit("<name>", …)` call sites (bare or property access). */
function collectEmitSites(sf: ts.SourceFile, out: Site[]): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (calleeName === "emit" && ts.isStringLiteral(node.arguments[0])) {
        const { line } = sf.getLineAndCharacterOfPosition(node.arguments[0].getStart(sf));
        out.push({
          file: path.relative(STREAMING_ROOT, sf.fileName),
          name: node.arguments[0].text,
          line: line + 1,
        });
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
}

/** Runtime object literals carrying `type: "<literal>"` (construction sites). */
function collectTypeDiscriminantConstructions(sf: ts.SourceFile, out: Set<string>): void {
  const visit = (node: ts.Node): void => {
    // Type declarations spell variants as PropertySignatures, not object
    // literals, so they cannot leak into this set — but skip them anyway so
    // a `satisfies`-style refactor cannot change that invariant silently.
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
          prop.name.text === "type" &&
          ts.isStringLiteral(prop.initializer)
        ) {
          out.add(prop.initializer.text);
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
}

// ---------------------------------------------------------------------------
// Analysis (computed once)
// ---------------------------------------------------------------------------

const liveCandleEvents = mapKeysOfAlias(parseFile(STREAMING_TYPES), "LiveCandleEventMap");
const sessionEvents = discriminantsOfUnion(parseFile(STREAMING_TYPES), "SessionEvent");
const positionEvents = discriminantsOfUnion(parseFile(POSITION_TYPES), "PositionEvent");

const emitSites: Site[] = [];
const constructedDiscriminants = new Set<string>();
for (const file of walkTsFiles(STREAMING_ROOT)) {
  const sf = parseFile(file);
  collectEmitSites(sf, emitSites);
  collectTypeDiscriminantConstructions(sf, constructedDiscriminants);
}
const emittedNames = new Set(emitSites.map((s) => s.name));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streaming event contract wiring", () => {
  it("parses the declared contracts (sanity)", () => {
    expect(liveCandleEvents).toContain("tick");
    expect(liveCandleEvents).toContain("candleComplete");
    expect(sessionEvents.length).toBeGreaterThanOrEqual(5);
    expect(positionEvents.length).toBeGreaterThanOrEqual(3);
    expect(emitSites.length).toBeGreaterThan(0);
    expect(constructedDiscriminants.size).toBeGreaterThan(0);
  });

  it("every LiveCandleEventMap key is emitted somewhere in streaming/", () => {
    const dead = liveCandleEvents.filter((name) => !emittedNames.has(name));
    expect(
      dead,
      `LiveCandleEventMap key(s) declared but never emitted ` +
        `(subscribers can register but the event never fires):\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every literal emit name in streaming/ is a declared LiveCandleEventMap key", () => {
    const undeclared = emitSites.filter((s) => !liveCandleEvents.includes(s.name));
    const report = undeclared.map((s) => `  ${s.file}:${s.line} emits "${s.name}"`).join("\n");
    expect(
      undeclared,
      `emit() call(s) using an event name missing from LiveCandleEventMap ` +
        `(no subscriber can type-safely listen for these):\n${report}`,
    ).toEqual([]);
  });

  it("every SessionEvent variant is constructed somewhere in streaming/", () => {
    const dead = sessionEvents.filter((name) => !constructedDiscriminants.has(name));
    expect(
      dead,
      `SessionEvent variant(s) declared in streaming/types.ts but never ` +
        `constructed (consumers can switch on them but they never occur):\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every PositionEvent variant is constructed somewhere in streaming/", () => {
    const dead = positionEvents.filter((name) => !constructedDiscriminants.has(name));
    expect(
      dead,
      `PositionEvent variant(s) declared in position-manager/types.ts but never ` +
        `constructed (consumers can switch on them but they never occur):\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  });
});
