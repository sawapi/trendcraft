// @vitest-environment node
/**
 * Contract-wiring guard for the ChartEvent union.
 *
 * Motivation: an audit found event names that were DECLARED in the ChartEvent
 * union (and documented / subscribed to) but never EMITTED anywhere in the
 * renderer — `resize`, `paneResize`, `seriesRemoved` shipped as dead contract
 * surface until they were wired up. This test makes the whole class of bug
 * impossible to reintroduce silently:
 *
 *   1. Forward guard — every member of the ChartEvent union must have at
 *      least one emission site (`_emit("<name>", …)` / `emit("<name>", …)`)
 *      somewhere in packages/chart/src (tests excluded).
 *   2. Reverse guard — every event-name string literal passed to an emit
 *      call must be a declared member of the union (catches emitting an
 *      event no subscriber can ever type-safely listen for).
 *
 * Both sides are extracted with the TypeScript AST (not regex) so string
 * literals in comments or unrelated code cannot create false hits, and
 * dynamic emits (`emit(event as ChartEvent, …)`) are ignored — only literal
 * event names are checkable, and all intentional emission sites use literals.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(here, ".."); // packages/chart/src
const EVENT_TYPES_FILE = path.join(SRC_ROOT, "core/types/event.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function parseFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

/** Extract the string-literal members of the `ChartEvent` union type alias. */
function extractChartEventUnion(): string[] {
  const sf = parseFile(EVENT_TYPES_FILE);
  let members: string[] | null = null;
  sf.forEachChild((node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== "ChartEvent") return;
    const collected: string[] = [];
    const collect = (t: ts.TypeNode): void => {
      if (ts.isUnionTypeNode(t)) {
        for (const part of t.types) collect(part);
      } else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
        collected.push(t.literal.text);
      }
    };
    collect(node.type);
    members = collected;
  });
  if (!members) throw new Error(`ChartEvent type alias not found in ${EVENT_TYPES_FILE}`);
  return members;
}

type EmitSite = { file: string; name: string; line: number };

/**
 * Collect every `emit("<literal>", …)` / `_emit("<literal>", …)` call.
 * Matches both bare identifiers (`_emit(…)` is rare) and property access
 * (`this._emit(…)`, `this._deps.emit(…)`, `rc.emit(…)`).
 */
function collectEmitSites(sf: ts.SourceFile, out: EmitSite[]): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (calleeName === "emit" || calleeName === "_emit") {
        const arg0 = node.arguments[0];
        if (ts.isStringLiteral(arg0)) {
          const { line } = sf.getLineAndCharacterOfPosition(arg0.getStart(sf));
          out.push({
            file: path.relative(SRC_ROOT, sf.fileName),
            name: arg0.text,
            line: line + 1,
          });
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
}

// ---------------------------------------------------------------------------
// Analysis (computed once — pure fs + AST, no DOM)
// ---------------------------------------------------------------------------

const unionMembers = extractChartEventUnion();
const emitSites: EmitSite[] = [];
for (const file of walkTsFiles(SRC_ROOT)) {
  collectEmitSites(parseFile(file), emitSites);
}
const emittedNames = new Set(emitSites.map((s) => s.name));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChartEvent contract wiring", () => {
  it("parses the ChartEvent union (sanity)", () => {
    // If the union moves or is renamed this fails loudly instead of the
    // wiring checks silently passing on an empty list.
    expect(unionMembers.length).toBeGreaterThanOrEqual(10);
    expect(unionMembers).toContain("crosshairMove");
  });

  it("finds literal emit sites in src (sanity)", () => {
    expect(emitSites.length).toBeGreaterThan(0);
  });

  it("every declared ChartEvent member is emitted somewhere in src", () => {
    const dead = unionMembers.filter((name) => !emittedNames.has(name));
    expect(
      dead,
      `ChartEvent member(s) declared in core/types/event.ts but never emitted in src/ ` +
        `(dead contract surface — subscribers can register but the event never fires). ` +
        `Either wire an emission site or remove the member from the union:\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every emitted event name is a declared ChartEvent member", () => {
    const undeclared = emitSites.filter((s) => !unionMembers.includes(s.name));
    const report = undeclared.map((s) => `  ${s.file}:${s.line} emits "${s.name}"`).join("\n");
    expect(
      undeclared,
      `Emit site(s) using an event name that is not in the ChartEvent union ` +
        `(no subscriber can type-safely listen for these). Add the name to the union ` +
        `in core/types/event.ts or fix the emit call:\n${report}`,
    ).toEqual([]);
  });
});
