// @vitest-environment node
/**
 * Doc-snippet harness (Tier 1 — import check).
 *
 * Scans EVERY fenced `ts`/`typescript` block in the package docs (not just the
 * `<!-- doctest-run -->` subset that Tier 2 executes) and validates the
 * `trendcraft` imports against the real package surface:
 *
 *   1. Subpath validity — every `from "trendcraft/<sub>"` must be a published
 *      `exports` subpath in package.json (catches docs referencing a subpath
 *      that was never wired up, e.g. a stale `trendcraft/streaming`).
 *   2. Named-export validity — every named *value* import must be a real export
 *      of the resolved in-repo entry (catches docs importing a removed/renamed
 *      symbol, e.g. a deleted `setBenchmark`).
 *   3. Namespace-member validity — when a snippet destructures a namespace it
 *      imported (`import { streaming } from "trendcraft"; const { foo } =
 *      streaming;`, or `import * as ns from "trendcraft/<sub>"`), every
 *      destructured name must be a real member of that namespace (catches a
 *      removed/renamed helper reached through the namespace).
 *
 * This is the cheap, robust complement to Tier 2: it covers the non-executed
 * majority of snippets without compiling them. Type-only imports (`import type`
 * and `type`-prefixed specifiers) are skipped — their existence can't be proven
 * from the runtime module surface, and that is the fragile part Tier 1 avoids.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");

// All doc surfaces that carry `ts` fences (paths relative to the package root),
// including the Japanese translations and the READMEs — every place a published
// import is shown to a reader is just as prone to drift.
const DOC_FILES = [
  "docs/COOKBOOK.md",
  "docs/GUIDE.md",
  "docs/API.md",
  "docs/GUIDE.ja.md",
  "docs/API.ja.md",
  "README.md",
  "README.ja.md",
];

// Map each published subpath to its in-repo source entry (relative to this
// test file). Mirrors the rewrites in the Tier 2 harness; the main entry is "".
const SUBPATH_TO_SOURCE: Record<string, string> = {
  "": "../index",
  screening: "../screening",
  incremental: "../indicators/incremental",
  safe: "../indicators/safe",
  manifest: "../manifest",
};

// Valid published subpaths come straight from package.json `exports` so this
// check tracks the real packaging surface, not a hand-maintained list.
const pkgJson = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
const VALID_SUBPATHS = new Set(
  Object.keys(pkgJson.exports ?? { ".": {} }).map((k) => (k === "." ? "" : k.replace(/^\.\//, ""))),
);

type ImportRef = { file: string; source: string; subpath: string; names: string[]; raw: string };
// A local binding that holds a namespace object (whole module, or a named
// export that is itself a namespace like `streaming`).
type NsBinding = { subpath: string; member: string | null };
type Destructure = { file: string; rhs: string; names: string[]; binding: NsBinding };

/** Extract `ts`/`typescript` fenced code from a doc file. */
function extractFences(file: string): string[] {
  const text = readFileSync(path.join(pkgRoot, file), "utf8");
  const out: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (/^```(ts|typescript)\s*$/.test(lines[i])) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      out.push(body.join("\n"));
    }
    i++;
  }
  return out;
}

/**
 * Strip `//` line and block comments. Doc imports routinely carry inline
 * comments inside the braces (`foo, // note`), which would otherwise fold into
 * the following specifier and hide it from validation. Module specifiers and
 * destructure right-hand sides are plain identifiers/`"trendcraft…"` strings
 * with no `//`, so stripping comments before parsing is safe here.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Parse `{ a, b as c, type T }` into `{ exported, local }` pairs. The exported
 * name is validated against the module's exports; the local name is what a later
 * destructure (`const { … } = c`) binds, so namespace bindings key on it.
 */
function parseImportPairs(brace: string): Array<{ exported: string; local: string }> {
  const pairs: Array<{ exported: string; local: string }> = [];
  for (const spec of brace.split(",")) {
    const s = spec.trim();
    if (!s || s === "..." || s.startsWith("type ")) continue;
    const parts = s.split(/\s+as\s+/);
    const exported = parts[0].trim();
    const local = (parts[1] ?? parts[0]).trim();
    if (/^[A-Za-z_$][\w$]*$/.test(exported)) pairs.push({ exported, local });
  }
  return pairs;
}

const IMPORT_RE = /import\s+([^;]*?)\s+from\s*['"](trendcraft(?:\/[\w-]+)?)['"]/g;
const DESTRUCTURE_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*([A-Za-z_$][\w$]*)\s*;?/g;

function parseSnippet(
  file: string,
  code: string,
): { imports: ImportRef[]; destructures: Destructure[] } {
  const src = stripComments(code);
  const imports: ImportRef[] = [];
  const nsBindings = new Map<string, NsBinding>();
  let m: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const clause = m[1].trim();
    const source = m[2];
    const subpath = source === "trendcraft" ? "" : source.replace(/^trendcraft\//, "");

    // Extract any checkable value names per import shape. The *source* is
    // recorded unconditionally below (every shape — named, namespace, type,
    // default — feeds the subpath-validity check), so no shape can slip past it.
    const names: string[] = [];
    if (!/^type\s/.test(clause)) {
      // `* as ns` can appear after a default import (`Foo, * as ns`), so match
      // it anywhere in the clause, not just at the start.
      const star = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (star) nsBindings.set(star[1], { subpath, member: null });
      const brace = clause.match(/\{([^}]*)\}/);
      if (brace) {
        // A named import may itself be a namespace object (e.g. `streaming`);
        // record each by its LOCAL name so an aliased destructure resolves.
        for (const { exported, local } of parseImportPairs(brace[1])) {
          names.push(exported);
          nsBindings.set(local, { subpath, member: exported });
        }
      }
    }
    imports.push({ file, source, subpath, names, raw: m[0] });
  }

  const destructures: Destructure[] = [];
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = DESTRUCTURE_RE.exec(src)) !== null) {
    const rhs = m[2];
    const binding = nsBindings.get(rhs);
    if (!binding) continue; // only destructures of a trendcraft namespace
    destructures.push({ file, rhs, names: parseImportPairs(m[1]).map((p) => p.exported), binding });
  }
  return { imports, destructures };
}

const parsed = DOC_FILES.flatMap((file) =>
  extractFences(file).map((code) => parseSnippet(file, code)),
);
const allRefs = parsed.flatMap((p) => p.imports);
const allDestructures = parsed.flatMap((p) => p.destructures);

describe("doc snippets — import check (Tier 1)", () => {
  it("found trendcraft imports to validate", () => {
    expect(allRefs.length).toBeGreaterThan(0);
  });

  it("every documented import uses a published subpath", () => {
    const bad = allRefs.filter((r) => !VALID_SUBPATHS.has(r.subpath));
    const report = bad.map((r) => `  ${r.file}: ${r.raw}`).join("\n");
    expect(bad.length, `Unpublished subpath(s) in docs:\n${report}`).toBe(0);
  });

  // Importing the full source entry can exceed the default 5s timeout when
  // the machine is loaded (the rest of the suite runs in parallel workers).
  it("every named value import resolves to a real export", { timeout: 30_000 }, async () => {
    const exportsBySubpath = new Map<string, Set<string>>();
    for (const subpath of new Set(allRefs.map((r) => r.subpath))) {
      const source = SUBPATH_TO_SOURCE[subpath];
      if (!source) continue; // unpublished subpath — reported by the test above
      const mod = await import(source);
      exportsBySubpath.set(subpath, new Set(Object.keys(mod)));
    }

    const missing: string[] = [];
    for (const ref of allRefs) {
      const exported = exportsBySubpath.get(ref.subpath);
      if (!exported) continue;
      for (const name of ref.names) {
        if (!exported.has(name)) missing.push(`  ${ref.file}: "${name}" from "${ref.source}"`);
      }
    }
    expect(missing.length, `Unknown named import(s) in docs:\n${missing.join("\n")}`).toBe(0);
  });

  it("every destructured namespace member resolves to a real member", {
    timeout: 30_000,
  }, async () => {
    // Cache loaded source modules so each entry is imported once.
    const modBySubpath = new Map<string, Record<string, unknown>>();
    async function loadModule(subpath: string): Promise<Record<string, unknown> | null> {
      if (modBySubpath.has(subpath)) return modBySubpath.get(subpath) ?? null;
      const source = SUBPATH_TO_SOURCE[subpath];
      if (!source) return null;
      const mod = (await import(source)) as Record<string, unknown>;
      modBySubpath.set(subpath, mod);
      return mod;
    }

    const missing: string[] = [];
    for (const d of allDestructures) {
      const mod = await loadModule(d.binding.subpath);
      if (!mod) continue; // unpublished subpath — reported by the subpath test
      const ns = d.binding.member === null ? mod : mod[d.binding.member];
      // Only validate when the binding is actually a namespace-like object.
      if (!ns || typeof ns !== "object") continue;
      const members = new Set(Object.keys(ns));
      for (const name of d.names) {
        if (!members.has(name)) missing.push(`  ${d.file}: "${name}" from "${d.rhs}"`);
      }
    }
    expect(missing.length, `Unknown namespace member(s) in docs:\n${missing.join("\n")}`).toBe(0);
  });
});
