// @vitest-environment node
/**
 * Doc-snippet harness (Tier 1 — import check) for @trendcraft/chart.
 *
 * Scans EVERY fenced `ts`/`typescript`/`tsx`/`vue` block in the package docs
 * (not just the `<!-- doctest-run -->` subset that Tier 2 executes) and validates
 * the `@trendcraft/chart` and `trendcraft` imports against the real package
 * surface. `tsx`/`vue` fences carry the React/Vue wrapper examples
 * (`@trendcraft/chart/react`, `@trendcraft/chart/vue`), so excluding them would
 * leave the documented wrapper imports unchecked:
 *
 *   1. Subpath validity — every `from "@trendcraft/chart/<sub>"` must be a
 *      published `exports` subpath in package.json.
 *   2. Named-export validity — every named *value* import must be a real export
 *      of the resolved in-repo entry.
 *   3. Namespace-member validity — destructured members of an imported namespace
 *      (`const { foo } = ns`, or `import * as ns from "…"`) must be real members.
 *
 * The cheap, robust complement to Tier 2: it covers the non-executed majority of
 * snippets without compiling them. Type-only imports are skipped — their
 * existence can't be proven from the runtime surface.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");

// Absolute file URL to the core package *source* entry (a sibling workspace
// package). Dynamic `import()` of a runtime relative string crossing the
// package boundary mis-resolves under vitest, so resolve it to an absolute URL.
const CORE_SRC_INDEX = pathToFileURL(path.resolve(pkgRoot, "../core/src/index.ts")).href;

// Doc surfaces with code fences (relative to the package root), including the
// README — every place a published import is shown to a reader can drift.
const DOC_FILES = [
  "docs/API.md",
  "docs/COOKBOOK.md",
  "docs/GUIDE.md",
  "docs/LIVE.md",
  "docs/PLUGINS.md",
  "README.md",
];

// Each documented import source → its in-repo entry. Chart subpaths resolve to
// chart's own source (relative to this test file). `trendcraft` maps to the core
// *source* entry, not the bare specifier: the bare specifier resolves through
// the workspace `exports` to core's built `dist/index.js`, an ignored artifact
// absent in a clean checkout before `packages/core` is built — so resolve it to
// source like the chart subpaths do, keeping the test build-order-independent.
const SOURCE_TO_ENTRY: Record<string, string> = {
  "@trendcraft/chart": "../index",
  "@trendcraft/chart/headless": "../headless",
  "@trendcraft/chart/presets": "../presets",
  "@trendcraft/chart/replay": "../replay",
  "@trendcraft/chart/sparkline": "../sparkline",
  "@trendcraft/chart/react": "../../react/index",
  "@trendcraft/chart/react/sparkline": "../../react/sparkline",
  "@trendcraft/chart/vue": "../../vue/index",
  "@trendcraft/chart/vue/sparkline": "../../vue/sparkline",
  trendcraft: CORE_SRC_INDEX,
};

// Published chart subpaths from package.json `exports` (the real packaging
// surface). `trendcraft` is a separate package, always a valid dependency.
const pkgJson = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
const VALID_CHART_SOURCES = new Set(
  Object.keys(pkgJson.exports ?? { ".": {} }).map((k) =>
    k === "." ? "@trendcraft/chart" : `@trendcraft/chart${k.slice(1)}`,
  ),
);

type ImportRef = { file: string; source: string; names: string[]; raw: string };
type NsBinding = { source: string; member: string | null };
type Destructure = { file: string; rhs: string; names: string[]; binding: NsBinding };

function extractFences(file: string): string[] {
  const text = readFileSync(path.join(pkgRoot, file), "utf8");
  const out: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    // `tsx`/`vue` fences hold the React/Vue wrapper examples; a `vue` SFC's
    // imports live in its `<script>` block and are matched the same way.
    if (/^```(tsx?|typescript|vue)\s*$/.test(lines[i])) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      out.push(body.join("\n"));
    }
    i++;
  }
  return out;
}

/** Strip `//` line and block comments before parsing (inline import comments). */
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

const IMPORT_RE =
  /import\s+([^;]*?)\s+from\s*['"](@trendcraft\/chart(?:\/[\w-]+)*|trendcraft(?:\/[\w-]+)?)['"]/g;
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

    // Source is recorded unconditionally below regardless of import shape, so no
    // shape (named, namespace, type, default) can slip past the subpath check.
    const names: string[] = [];
    if (!/^type\s/.test(clause)) {
      // `* as ns` can appear after a default import (`Foo, * as ns`), so match
      // it anywhere in the clause, not just at the start.
      const star = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (star) nsBindings.set(star[1], { source, member: null });
      const brace = clause.match(/\{([^}]*)\}/);
      if (brace) {
        // Record each named import by its LOCAL name so an aliased destructure
        // (`const { … } = local`) resolves against the namespace.
        for (const { exported, local } of parseImportPairs(brace[1])) {
          names.push(exported);
          nsBindings.set(local, { source, member: exported });
        }
      }
    }
    imports.push({ file, source, names, raw: m[0] });
  }

  const destructures: Destructure[] = [];
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = DESTRUCTURE_RE.exec(src)) !== null) {
    const rhs = m[2];
    const binding = nsBindings.get(rhs);
    if (!binding) continue;
    destructures.push({ file, rhs, names: parseImportPairs(m[1]).map((p) => p.exported), binding });
  }
  return { imports, destructures };
}

const parsed = DOC_FILES.flatMap((file) =>
  extractFences(file).map((code) => parseSnippet(file, code)),
);
const allRefs = parsed.flatMap((p) => p.imports);
const allDestructures = parsed.flatMap((p) => p.destructures);

async function loadExports(source: string): Promise<Set<string> | null> {
  const entry = SOURCE_TO_ENTRY[source];
  if (!entry) return null;
  const mod = await import(entry);
  return new Set(Object.keys(mod));
}

describe("doc snippets — import check (Tier 1)", () => {
  it("found chart imports to validate", () => {
    expect(allRefs.length).toBeGreaterThan(0);
  });

  it("every @trendcraft/chart import uses a published subpath", () => {
    const bad = allRefs.filter(
      (r) => r.source.startsWith("@trendcraft/chart") && !VALID_CHART_SOURCES.has(r.source),
    );
    const report = bad.map((r) => `  ${r.file}: ${r.raw}`).join("\n");
    expect(bad.length, `Unpublished subpath(s) in docs:\n${report}`).toBe(0);
  });

  // Validating `trendcraft` imports dynamically loads the core package *source*
  // (130+ indicator modules) so the test stays build-independent; vitest has to
  // transform that whole graph, which can exceed the 5s default under the full
  // suite's parallel transform load. Give the two importing tests headroom.
  const IMPORT_TIMEOUT_MS = 30_000;

  it(
    "every named value import resolves to a real export",
    async () => {
      const exportsBySource = new Map<string, Set<string>>();
      for (const source of new Set(allRefs.map((r) => r.source))) {
        const exported = await loadExports(source);
        if (exported) exportsBySource.set(source, exported);
      }

      const missing: string[] = [];
      for (const ref of allRefs) {
        const exported = exportsBySource.get(ref.source);
        if (!exported) continue;
        for (const name of ref.names) {
          if (!exported.has(name)) missing.push(`  ${ref.file}: "${name}" from "${ref.source}"`);
        }
      }
      expect(missing.length, `Unknown named import(s) in docs:\n${missing.join("\n")}`).toBe(0);
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    "every destructured namespace member resolves to a real member",
    async () => {
      // Cache loaded source modules so each entry is imported once.
      const modBySource = new Map<string, Record<string, unknown>>();
      async function loadModule(source: string): Promise<Record<string, unknown> | null> {
        if (modBySource.has(source)) return modBySource.get(source) ?? null;
        const entry = SOURCE_TO_ENTRY[source];
        if (!entry) return null;
        const mod = (await import(entry)) as Record<string, unknown>;
        modBySource.set(source, mod);
        return mod;
      }

      const missing: string[] = [];
      for (const d of allDestructures) {
        const mod = await loadModule(d.binding.source);
        if (!mod) continue;
        const ns = d.binding.member === null ? mod : mod[d.binding.member];
        if (!ns || typeof ns !== "object") continue;
        const members = new Set(Object.keys(ns));
        for (const name of d.names) {
          if (!members.has(name)) missing.push(`  ${d.file}: "${name}" from "${d.rhs}"`);
        }
      }
      expect(missing.length, `Unknown namespace member(s) in docs:\n${missing.join("\n")}`).toBe(0);
    },
    IMPORT_TIMEOUT_MS,
  );
});
