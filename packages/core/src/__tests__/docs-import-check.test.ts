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
const docsDir = path.resolve(here, "../../docs");

// All doc files that carry runnable `ts` fences, including the Japanese
// translations (which contain the same imports and are just as prone to drift).
const DOC_FILES = ["COOKBOOK.md", "GUIDE.md", "API.md", "GUIDE.ja.md", "API.ja.md"];

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
type Destructure = {
  file: string;
  rhs: string;
  names: string[];
  nsBindings: Map<string, NsBinding>;
};

/** Extract `ts`/`typescript` fenced code from a doc file. */
function extractFences(file: string): string[] {
  const text = readFileSync(path.join(docsDir, file), "utf8");
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

/** Split a `{ a, b as c, type T }` specifier list into checkable value names. */
function parseSpecifiers(brace: string): string[] {
  const names: string[] = [];
  for (const spec of brace.split(",")) {
    const s = spec.trim();
    if (!s || s === "..." || s.startsWith("type ")) continue; // skip ellipsis + type specifiers
    const name = s.split(/\s+as\s+/)[0].trim(); // `a as b` → check `a`
    if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
  }
  return names;
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
    let names: string[] = [];
    const star = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (star) {
      // `import * as ns from "..."` → ns binds the whole module namespace.
      nsBindings.set(star[1], { subpath, member: null });
    } else if (!/^type\s/.test(clause)) {
      const brace = clause.match(/\{([^}]*)\}/);
      names = brace ? parseSpecifiers(brace[1]) : [];
      // A named import may itself be a namespace object (e.g. `streaming`);
      // record each as a candidate binding so a destructure can be validated.
      for (const n of names) nsBindings.set(n, { subpath, member: n });
    }
    imports.push({ file, source, subpath, names, raw: m[0] });
  }

  const destructures: Destructure[] = [];
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = DESTRUCTURE_RE.exec(src)) !== null) {
    const rhs = m[2];
    if (!nsBindings.has(rhs)) continue; // only destructures of a trendcraft namespace
    destructures.push({ file, rhs, names: parseSpecifiers(m[1]), nsBindings });
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

  it("every named value import resolves to a real export", async () => {
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

  it("every destructured namespace member resolves to a real member", async () => {
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
      const binding = d.nsBindings.get(d.rhs);
      if (!binding) continue;
      const mod = await loadModule(binding.subpath);
      if (!mod) continue; // unpublished subpath — reported by the subpath test
      const ns = binding.member === null ? mod : mod[binding.member];
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
