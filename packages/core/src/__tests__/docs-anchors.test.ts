// @vitest-environment node
/**
 * In-page link check: every `](#anchor)` in the package docs must name a
 * heading in the same file, by GitHub's anchor rules. A heading that gains
 * arguments or a parenthetical (`## Meta-Strategy (Equity Curve Trading)`)
 * silently strands the table-of-contents links to it (ops #126).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");

const DOCS = [
  ...readdirSync(path.join(pkgRoot, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
  "README.md",
  "README.ja.md",
];

/**
 * GitHub's heading anchor: lowercase, punctuation and symbols dropped (but
 * not `-` or `_`), spaces turned into `-`; repeats get `-1`, `-2`, ...
 */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** Anchors of every heading outside code fences. */
function anchorsOf(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const m of markdown.matchAll(/^#{1,6} (.+)$/gm)) {
    const s = slug(m[1]);
    const n = seen.get(s) ?? 0;
    seen.set(s, n + 1);
    anchors.add(n === 0 ? s : `${s}-${n}`);
  }
  return anchors;
}

describe("docs in-page links", () => {
  it("covers the docs it is meant to", () => {
    expect(DOCS).toEqual(expect.arrayContaining(["docs/API.md", "docs/API.ja.md"]));
  });

  it.each(DOCS)("%s: every #anchor names a heading", (file) => {
    const text = readFileSync(path.join(pkgRoot, file), "utf8").replace(/```[\s\S]*?```/g, "");
    const anchors = anchorsOf(text);
    const dead = [...text.matchAll(/\]\(#([^)]+)\)/g)]
      .map((m) => decodeURIComponent(m[1]))
      .filter((a) => !anchors.has(a));
    expect(dead).toEqual([]);
  });
});
